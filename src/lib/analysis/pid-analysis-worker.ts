/**
 * Web Worker for PID analysis.
 *
 * Runs the full analysis pipeline off the main thread:
 *   parse log → extract data → FFT → step response → tracking → motors → score
 *
 * IMPORTANT: Web workers cannot use @/ path aliases. All imports are relative.
 *
 * @license GPL-3.0-only
 */

import { parseDataFlashLog } from "../dataflash-parser";
import { extractLogData, extractVibration } from "./log-extractor";
import { computeFFT } from "./fft";
import { extractStepResponses } from "./step-response";
import { analyzeTracking } from "./tracking-quality";
import { analyzeMotors } from "./motor-analysis";
import type {
  WorkerInMessage,
  WorkerOutMessage,
  PidAnalysisResult,
  FFTResult,
  StepResponseResult,
  TrackingQualityResult,
  TuneIssue,
} from "./types";

// ---------------------------------------------------------------------------
// Progress helper
// ---------------------------------------------------------------------------

function postProgress(stage: string, percent: number): void {
  const msg: WorkerOutMessage = { type: "progress", stage, percent };
  self.postMessage(msg);
}

function postResult(data: PidAnalysisResult): void {
  const msg: WorkerOutMessage = { type: "result", data };
  self.postMessage(msg);
}

function postError(message: string): void {
  const msg: WorkerOutMessage = { type: "error", message };
  self.postMessage(msg);
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Score FFT noise quality (0-100). Lower peaks = better. */
function scoreFFTQuality(fft: FFTResult): number {
  let totalPeakMag = 0;
  let peakCount = 0;

  for (const axis of [fft.roll, fft.pitch, fft.yaw] as const) {
    for (const peak of axis.peaks) {
      totalPeakMag += Math.abs(peak.magnitudeDb - axis.noiseFloorDb);
      peakCount++;
    }
  }

  if (peakCount === 0) return 100;

  // Average peak prominence above noise floor
  const avgProminence = totalPeakMag / peakCount;
  // 0 dB prominence = 100 score, 40+ dB = 0
  return Math.max(0, Math.round(100 - avgProminence * 2.5));
}

/** Score step response quality (0-100). */
function scoreStepResponse(step: StepResponseResult): number {
  const allEvents = [...step.roll, ...step.pitch, ...step.yaw];
  if (allEvents.length === 0) return 50; // No step events found, neutral score

  let totalScore = 0;
  for (const event of allEvents) {
    let score = 100;

    // Penalize slow rise time (>50ms is slow for a multirotor)
    if (event.riseTimeMs > 50) {
      score -= Math.min((event.riseTimeMs - 50) * 0.5, 30);
    }

    // Penalize overshoot (>20% is concerning)
    if (event.overshootPercent > 20) {
      score -= Math.min((event.overshootPercent - 20) * 0.5, 30);
    }

    // Penalize long settling (>200ms is slow)
    if (event.settlingTimeMs > 200) {
      score -= Math.min((event.settlingTimeMs - 200) * 0.1, 20);
    }

    // Penalize very low damping (bouncy) or very high (sluggish)
    if (event.dampingRatio < 0.5) {
      score -= (0.5 - event.dampingRatio) * 40;
    } else if (event.dampingRatio > 1.5) {
      score -= (event.dampingRatio - 1.5) * 20;
    }

    totalScore += Math.max(0, score);
  }

  return Math.round(totalScore / allEvents.length);
}

// ---------------------------------------------------------------------------
// Issue detection
// ---------------------------------------------------------------------------

function detectIssues(
  fft: FFTResult,
  step: StepResponseResult,
  tracking: TrackingQualityResult,
  motorAnalysis: ReturnType<typeof analyzeMotors>,
  vibLevel: string,
): TuneIssue[] {
  const issues: TuneIssue[] = [];

  // Propwash peaks
  for (const axis of [fft.roll, fft.pitch, fft.yaw] as const) {
    const propwashPeaks = axis.peaks.filter((p) => p.zone === "propwash");
    if (propwashPeaks.length > 0) {
      const strongest = propwashPeaks[0];
      const prominence = strongest.magnitudeDb - axis.noiseFloorDb;
      if (prominence > 10) {
        issues.push({
          severity: prominence > 20 ? "critical" : "warning",
          title: `Propwash oscillation on ${axis.axis}`,
          description: `${strongest.frequency.toFixed(0)} Hz peak at ${strongest.magnitudeDb.toFixed(1)} dB (${prominence.toFixed(1)} dB above noise floor)`,
          affectedAxis: axis.axis,
        });
      }
    }
  }

  // Motor oscillation
  for (const motor of motorAnalysis.motors) {
    if (motor.hasOscillation) {
      issues.push({
        severity: "warning",
        title: `Motor ${motor.motorIndex + 1} oscillation`,
        description: `PWM standard deviation ${motor.oscillationScore.toFixed(1)} (threshold: 50)`,
        affectedMotor: motor.motorIndex,
      });
    }
  }

  // Motor saturation
  for (const motor of motorAnalysis.motors) {
    if (motor.saturationPercent > 5) {
      issues.push({
        severity: motor.saturationPercent > 20 ? "critical" : "warning",
        title: `Motor ${motor.motorIndex + 1} saturation`,
        description: `${motor.saturationPercent.toFixed(1)}% of samples above 1900us`,
        affectedMotor: motor.motorIndex,
      });
    }
  }

  // Motor imbalance
  if (motorAnalysis.imbalanceScore > 10) {
    issues.push({
      severity: motorAnalysis.imbalanceScore > 20 ? "critical" : "warning",
      title: "Motor imbalance detected",
      description: `Imbalance score ${motorAnalysis.imbalanceScore.toFixed(1)}% — check motor mounting, props, and CG`,
    });
  }

  // Tracking quality
  for (const axis of [tracking.roll, tracking.pitch, tracking.yaw] as const) {
    if (axis.score < 50) {
      issues.push({
        severity: axis.score < 25 ? "critical" : "warning",
        title: `Poor tracking on ${axis.axis}`,
        description: `RMS error ${axis.rmsError.toFixed(1)} deg/s, score ${axis.score}/100, phase lag ${axis.phaseLagMs.toFixed(1)} ms`,
        affectedAxis: axis.axis,
      });
    }
  }

  // Step response problems
  for (const axis of ["roll", "pitch", "yaw"] as const) {
    const events = step[axis];
    if (events.length === 0) continue;

    const avgOvershoot =
      events.reduce((s, e) => s + e.overshootPercent, 0) / events.length;
    if (avgOvershoot > 30) {
      issues.push({
        severity: avgOvershoot > 50 ? "critical" : "warning",
        title: `High overshoot on ${axis}`,
        description: `Average ${avgOvershoot.toFixed(0)}% overshoot — consider reducing D or P gain`,
        affectedAxis: axis,
      });
    }
  }

  // Vibration
  if (vibLevel === "bad") {
    issues.push({
      severity: "critical",
      title: "High vibration levels",
      description:
        "Vibration exceeds safe limits — check mounting, props, and frame integrity before PID tuning",
    });
  } else if (vibLevel === "marginal") {
    issues.push({
      severity: "warning",
      title: "Marginal vibration levels",
      description:
        "Vibration is elevated — physical vibration isolation may help before further PID tuning",
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === "cancel") {
    return;
  }

  if (msg.type === "analyze") {
    try {
      // 1. Parse log
      postProgress("Parsing log file...", 10);
      const log = parseDataFlashLog(msg.buffer);

      // 2. Extract data
      postProgress("Extracting data...", 20);
      const data = extractLogData(log, msg.buffer.byteLength);

      // 3. FFT on each gyro axis
      postProgress("Computing FFT...", 40);
      const fft: FFTResult = {
        roll: computeFFT(
          data.gyro.roll,
          data.sampleRates.gyro || 400,
          "roll",
        ),
        pitch: computeFFT(
          data.gyro.pitch,
          data.sampleRates.gyro || 400,
          "pitch",
        ),
        yaw: computeFFT(
          data.gyro.yaw,
          data.sampleRates.gyro || 400,
          "yaw",
        ),
      };

      // 4. Step response
      postProgress("Analyzing step response...", 55);
      const stepResponse: StepResponseResult = {
        roll: extractStepResponses(
          data.desiredRate.roll,
          data.actualRate.roll,
          "roll",
        ),
        pitch: extractStepResponses(
          data.desiredRate.pitch,
          data.actualRate.pitch,
          "pitch",
        ),
        yaw: extractStepResponses(
          data.desiredRate.yaw,
          data.actualRate.yaw,
          "yaw",
        ),
      };

      // 5. Tracking quality
      postProgress("Evaluating tracking...", 70);
      const rollTracking = analyzeTracking(
        data.desiredRate.roll,
        data.actualRate.roll,
        "roll",
      );
      const pitchTracking = analyzeTracking(
        data.desiredRate.pitch,
        data.actualRate.pitch,
        "pitch",
      );
      const yawTracking = analyzeTracking(
        data.desiredRate.yaw,
        data.actualRate.yaw,
        "yaw",
      );
      const tracking: TrackingQualityResult = {
        roll: rollTracking,
        pitch: pitchTracking,
        yaw: yawTracking,
        overallScore: Math.round(
          (rollTracking.score + pitchTracking.score + yawTracking.score) / 3,
        ),
      };

      // 6. Motor analysis
      postProgress("Analyzing motors...", 85);
      const motors = analyzeMotors(data.motors);

      // 7. Compute overall tune score and identify issues
      postProgress("Scoring...", 95);

      const vibration = extractVibration(log);

      // Weighted score: tracking 40%, motor health 25%, FFT quality 20%, step response 15%
      const fftScore = scoreFFTQuality(fft);
      const stepScore = scoreStepResponse(stepResponse);

      const tuneScore = Math.round(
        tracking.overallScore * 0.4 +
          motors.healthScore * 0.25 +
          fftScore * 0.2 +
          stepScore * 0.15,
      );

      const issues = detectIssues(
        fft,
        stepResponse,
        tracking,
        motors,
        vibration.level,
      );

      const result: PidAnalysisResult = {
        metadata: data.metadata,
        fft,
        stepResponse,
        tracking,
        motors,
        vibration,
        tuneScore,
        issues,
      };

      postResult(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown analysis error";
      postError(message);
    }
  }
};
