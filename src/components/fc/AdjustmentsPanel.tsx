"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "./PanelHeader";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { SlidersHorizontal, Save, RotateCcw, HardDrive, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelScroll } from "@/hooks/use-panel-scroll";

// ── Constants ──

const ADJUSTMENT_SLOT_COUNT = 4;

/** Step-to-PWM conversion (Betaflight convention: PWM = 900 + step * 25) */
function stepToPwm(step: number): number {
  return 900 + step * 25;
}

function pwmToStep(pwm: number): number {
  return Math.round((pwm - 900) / 25);
}

const TOTAL_STEPS = 48; // 900-2100 in steps of 25

/**
 * Adjustment function names (Betaflight MSP_ADJUSTMENT_RANGES).
 * 33 functions (0-32) matching BF Configurator AdjustmentsTab.vue.
 */
const ADJUSTMENT_FUNCTIONS = [
  { value: "0", label: "RC Rate" },
  { value: "1", label: "RC Expo" },
  { value: "2", label: "Throttle Expo" },
  { value: "3", label: "Roll Rate" },
  { value: "4", label: "Pitch Rate" },
  { value: "5", label: "Yaw Rate" },
  { value: "6", label: "PID Roll P" },
  { value: "7", label: "PID Roll I" },
  { value: "8", label: "PID Roll D" },
  { value: "9", label: "PID Pitch P" },
  { value: "10", label: "PID Pitch I" },
  { value: "11", label: "PID Pitch D" },
  { value: "12", label: "PID Yaw P" },
  { value: "13", label: "PID Yaw I" },
  { value: "14", label: "PID Yaw D" },
  { value: "15", label: "PID Roll F" },
  { value: "16", label: "PID Pitch F" },
  { value: "17", label: "PID Yaw F" },
  { value: "18", label: "Rate Profile" },
  { value: "19", label: "PID Profile" },
  { value: "20", label: "OSD Profile" },
  { value: "21", label: "LED Profile" },
  { value: "22", label: "Gyro LPF" },
  { value: "23", label: "D-term LPF" },
  { value: "24", label: "RC Rate Yaw" },
  { value: "25", label: "PID Audio" },
  { value: "26", label: "Roll Pitch Ratio" },
  { value: "27", label: "Anti Gravity" },
  { value: "28", label: "Landing Gear" },
  { value: "29", label: "OSD Profile Change" },
  { value: "30", label: "LED Profile Change" },
  { value: "31", label: "Rates Collection" },
  { value: "32", label: "Slider Master Multiplier" },
];

const AUX_CHANNELS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: `AUX ${i + 1}`,
}));

// Virtual params for adjustments — these map to MSP adjustment range data
function buildParamNames(): string[] {
  const names: string[] = [];
  for (let i = 0; i < ADJUSTMENT_SLOT_COUNT; i++) {
    names.push(
      `BF_ADJ${i}_ENABLE`,
      `BF_ADJ${i}_CHANNEL`,
      `BF_ADJ${i}_RANGE_LOW`,
      `BF_ADJ${i}_RANGE_HIGH`,
      `BF_ADJ${i}_FUNCTION`,
      `BF_ADJ${i}_VIA_CHANNEL`,
    );
  }
  return names;
}

const paramNames = buildParamNames();

// ── Panel ──

export function AdjustmentsPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const scrollRef = usePanelScroll("adjustments");

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash, revertAll,
  } = usePanelParams({ paramNames, panelId: "adjustments", autoLoad: true });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

  // Live RC channel data for range slider indicators
  const rcBuffer = useTelemetryStore((s) => s.rc);
  const latestRc = rcBuffer.latest();

  const p = (name: string, fallback = 0) => String(params.get(name) ?? fallback);
  const pNum = (name: string, fallback = 0) => Number(params.get(name) ?? fallback);

  // Handle enable toggle — when disabling, reset range to 900-900 (BF convention)
  const handleEnableToggle = useCallback((slotIndex: number, currentlyEnabled: boolean) => {
    if (currentlyEnabled) {
      // Disabling: reset range to 900-900
      setLocalValue(`BF_ADJ${slotIndex}_ENABLE`, 0);
      setLocalValue(`BF_ADJ${slotIndex}_RANGE_LOW`, 900);
      setLocalValue(`BF_ADJ${slotIndex}_RANGE_HIGH`, 900);
    } else {
      // Enabling: set default range if both are the same
      setLocalValue(`BF_ADJ${slotIndex}_ENABLE`, 1);
      const low = pNum(`BF_ADJ${slotIndex}_RANGE_LOW`);
      const high = pNum(`BF_ADJ${slotIndex}_RANGE_HIGH`);
      if (low === high) {
        setLocalValue(`BF_ADJ${slotIndex}_RANGE_LOW`, 1300);
        setLocalValue(`BF_ADJ${slotIndex}_RANGE_HIGH`, 1700);
      }
    }
  }, [setLocalValue, pNum]);

  async function handleSave() {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) toast("Saved to flight controller", "success");
    else toast("Some parameters failed to save", "warning");
  }

  async function handleFlash() {
    const ok = await commitToFlash();
    if (ok) toast("Written to flash — persists after reboot", "success");
    else toast("Failed to write to flash", "error");
  }

  function handleRevert() {
    revertAll();
    toast("Reverted to FC values", "info");
  }

  // Get the live PWM for a given AUX channel (0-based, AUX1=0)
  const getAuxPwm = useCallback((auxChannelIndex: number): number => {
    if (!latestRc) return 0;
    // AUX channels start at RC channel index 4
    return latestRc.channels[auxChannelIndex + 4] ?? 0;
  }, [latestRc]);

  // Sorted function options (alphabetical, keeping original indices)
  const sortedFunctions = useMemo(() => {
    const copy = [...ADJUSTMENT_FUNCTIONS];
    copy.sort((a, b) => a.label.localeCompare(b.label));
    return copy;
  }, []);

  return (
    <ArmedLockOverlay>
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-6">
        <PanelHeader
          title="Adjustments"
          subtitle="In-flight parameter adjustment via RC channels"
          icon={<SlidersHorizontal size={16} />}
          loading={loading}
          loadProgress={loadProgress}
          hasLoaded={hasLoaded}
          onRead={refresh}
          connected={connected}
          error={error}
        />

        <p className="text-xs text-text-tertiary">
          Assign RC channel ranges to adjust PID, rate, and other parameters in flight.
          Each slot maps a switch channel (enable range) and an adjustment channel (value).
        </p>

        {/* Live RC channel preview */}
        {hasLoaded && latestRc && (
          <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-accent-primary"><Radio size={14} /></span>
              <div>
                <h2 className="text-sm font-medium text-text-primary">Live RC Channels</h2>
                <p className="text-[10px] text-text-tertiary">Current AUX channel PWM values</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }, (_, i) => {
                const pwm = getAuxPwm(i);
                const pct = pwm > 0 ? ((pwm - 900) / 1200) * 100 : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-text-secondary">AUX {i + 1}</span>
                      <span className="font-mono text-accent-primary tabular-nums">
                        {pwm > 0 ? pwm : "\u2014"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Adjustment slots */}
        {hasLoaded && (
          <div className="space-y-3">
            {Array.from({ length: ADJUSTMENT_SLOT_COUNT }, (_, i) => {
              const enabled = pNum(`BF_ADJ${i}_ENABLE`) === 1;
              const rangeLow = pNum(`BF_ADJ${i}_RANGE_LOW`, 900);
              const rangeHigh = pNum(`BF_ADJ${i}_RANGE_HIGH`, 2100);
              const auxChannel = pNum(`BF_ADJ${i}_CHANNEL`);
              const activePwm = getAuxPwm(auxChannel);

              return (
                <div
                  key={i}
                  className={cn(
                    "border border-border-default bg-bg-secondary p-4 space-y-3 transition-opacity",
                    !enabled && "opacity-50",
                  )}
                >
                  {/* Slot header */}
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => handleEnableToggle(i, enabled)}
                        className="accent-accent-primary w-4 h-4"
                      />
                      <span className="text-xs font-medium text-text-primary">
                        Slot {i}
                      </span>
                    </label>
                    {enabled && (
                      <span className="text-[10px] text-text-tertiary">
                        {ADJUSTMENT_FUNCTIONS.find(f => f.value === p(`BF_ADJ${i}_FUNCTION`))?.label ?? "Unknown"}
                      </span>
                    )}
                  </div>

                  {enabled && (
                    <>
                      {/* Controls row */}
                      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
                        <div>
                          <label className="text-[10px] text-text-tertiary block mb-1">
                            When Channel
                          </label>
                          <Select
                            options={AUX_CHANNELS}
                            value={p(`BF_ADJ${i}_CHANNEL`)}
                            onChange={(v) => setLocalValue(`BF_ADJ${i}_CHANNEL`, Number(v))}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-tertiary block mb-1">
                            Apply Function
                          </label>
                          <Select
                            options={sortedFunctions}
                            value={p(`BF_ADJ${i}_FUNCTION`)}
                            onChange={(v) => setLocalValue(`BF_ADJ${i}_FUNCTION`, Number(v))}
                            searchable
                            searchPlaceholder="Search functions..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-tertiary block mb-1">
                            Via Channel
                          </label>
                          <Select
                            options={AUX_CHANNELS}
                            value={p(`BF_ADJ${i}_VIA_CHANNEL`)}
                            onChange={(v) => setLocalValue(`BF_ADJ${i}_VIA_CHANNEL`, Number(v))}
                          />
                        </div>
                      </div>

                      {/* Range slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-text-secondary">
                          <span>{rangeLow} \u00B5s</span>
                          <span className="text-text-tertiary">Activation Range</span>
                          <span>{rangeHigh} \u00B5s</span>
                        </div>
                        <AdjustmentRangeSlider
                          start={pwmToStep(Math.max(900, Math.min(2100, rangeLow)))}
                          end={pwmToStep(Math.max(900, Math.min(2100, rangeHigh)))}
                          activePwm={activePwm}
                          onChange={(startStep, endStep) => {
                            setLocalValue(`BF_ADJ${i}_RANGE_LOW`, stepToPwm(startStep));
                            setLocalValue(`BF_ADJ${i}_RANGE_HIGH`, stepToPwm(endStep));
                          }}
                          dirty={
                            dirtyParams.has(`BF_ADJ${i}_RANGE_LOW`) ||
                            dirtyParams.has(`BF_ADJ${i}_RANGE_HIGH`)
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Available functions reference */}
        <div className="border border-border-default bg-bg-secondary p-4">
          <h3 className="text-xs font-medium text-text-primary mb-2">Available Functions</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5">
            {ADJUSTMENT_FUNCTIONS.map((f) => (
              <span key={f.value} className="text-[10px] text-text-tertiary font-mono">
                {f.value.padStart(2, "\u2007")}: {f.label}
              </span>
            ))}
          </div>
        </div>

        {/* Save / Revert */}
        <div className="flex items-center gap-3 pt-2 pb-4">
          <Button
            variant="primary"
            size="lg"
            icon={<Save size={14} />}
            disabled={!hasDirty || !connected}
            loading={saving}
            onClick={handleSave}
          >
            Save to Flight Controller
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<RotateCcw size={14} />}
            disabled={!hasDirty}
            onClick={handleRevert}
          >
            Revert
          </Button>
          {hasRamWrites && (
            <Button
              variant="secondary"
              size="lg"
              icon={<HardDrive size={14} />}
              onClick={handleFlash}
            >
              Write to Flash
            </Button>
          )}
          {!connected && (
            <span className="text-[10px] text-text-tertiary">Connect a drone to save parameters</span>
          )}
          {hasDirty && connected && (
            <span className="text-[10px] text-status-warning">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
    </ArmedLockOverlay>
  );
}

// ── Range Slider Component ──

function AdjustmentRangeSlider({
  start,
  end,
  activePwm,
  onChange,
  dirty,
}: {
  start: number; // step value 0-48
  end: number;
  activePwm: number;
  onChange: (start: number, end: number) => void;
  dirty: boolean;
}) {
  const startPct = (start / TOTAL_STEPS) * 100;
  const endPct = (end / TOTAL_STEPS) * 100;
  const activePct =
    activePwm > 0
      ? (pwmToStep(Math.min(2100, Math.max(900, activePwm))) / TOTAL_STEPS) * 100
      : -1;
  const isInRange =
    activePwm > 0 &&
    activePwm >= stepToPwm(start) &&
    activePwm <= stepToPwm(end);

  return (
    <div className="relative h-8 select-none">
      {/* Track background */}
      <div className="absolute top-3 left-0 right-0 h-2 bg-bg-tertiary rounded-full" />

      {/* Active range highlight */}
      <div
        className={cn(
          "absolute top-3 h-2 rounded-full transition-colors",
          dirty
            ? "bg-status-warning/50"
            : isInRange
              ? "bg-status-success/60"
              : "bg-accent-primary/40",
        )}
        style={{
          left: `${startPct}%`,
          width: `${Math.max(0, endPct - startPct)}%`,
        }}
      />

      {/* Live channel indicator */}
      {activePct >= 0 && (
        <div
          className={cn(
            "absolute top-1.5 w-0.5 h-5 rounded-full",
            isInRange ? "bg-status-success" : "bg-text-tertiary",
          )}
          style={{ left: `${activePct}%` }}
        />
      )}

      {/* Start thumb */}
      <input
        type="range"
        min={0}
        max={TOTAL_STEPS}
        value={start}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v < end) onChange(v, end);
        }}
        className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
        style={{ pointerEvents: "auto" }}
      />

      {/* End thumb */}
      <input
        type="range"
        min={0}
        max={TOTAL_STEPS}
        value={end}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v > start) onChange(start, v);
        }}
        className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
        style={{ pointerEvents: "auto" }}
      />

      {/* PWM labels */}
      <div className="absolute -bottom-1 left-0 right-0 flex justify-between text-[8px] text-text-tertiary font-mono">
        <span>900</span>
        <span>1500</span>
        <span>2100</span>
      </div>
    </div>
  );
}
