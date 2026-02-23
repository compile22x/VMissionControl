"use client";

import { useRef, useEffect, useCallback } from "react";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useDroneStore } from "@/stores/drone-store";
import { useMissionStore } from "@/stores/mission-store";
import { mpsToKph, normalizeHeading, degToRad } from "@/lib/telemetry-utils";

// ── Colors ──────────────────────────────────────────────────────
const HUD_GREEN = "#00ff41";
const ARMED_RED = "#ef4444";
const DISARMED_GREEN = "#22c55e";
const BAT_GREEN = "#22c55e";
const BAT_AMBER = "#f59e0b";
const BAT_RED = "#ef4444";
const SHADOW = "rgba(0,0,0,0.8)";
const FONT = '"JetBrains Mono", monospace';

function batColor(pct: number): string {
  if (pct > 50) return BAT_GREEN;
  if (pct > 25) return BAT_AMBER;
  return BAT_RED;
}

function formatTimerFromMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Drawing helpers ─────────────────────────────────────────────

function setHudStyle(
  ctx: CanvasRenderingContext2D,
  color: string,
  size: number,
  align: CanvasTextAlign = "center",
  baseline: CanvasTextBaseline = "middle"
) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawCrosshair(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const arm = 20;
  const gap = 6;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = HUD_GREEN;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.beginPath();
  // horizontal
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(cx + arm, cy);
  // vertical
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();

  // center dot
  ctx.fillStyle = HUD_GREEN;
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  clearShadow(ctx);
}

function drawPitchLadder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pitch: number,
  roll: number,
  h: number
) {
  const ladderH = h * 0.4;
  const pxPerDeg = ladderH / 40; // 40 deg visible range

  ctx.save();
  // Clip to a region so pitch lines don't overflow everywhere
  ctx.beginPath();
  ctx.rect(cx - 140, cy - ladderH / 2 - 10, 280, ladderH + 20);
  ctx.clip();

  ctx.translate(cx, cy);
  ctx.rotate(-degToRad(roll));

  ctx.lineWidth = 1;
  ctx.strokeStyle = HUD_GREEN;
  ctx.fillStyle = HUD_GREEN;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let deg = -90; deg <= 90; deg += 5) {
    if (deg === 0) continue; // horizon drawn separately
    const yOff = -(deg - pitch) * pxPerDeg;
    const halfLen = deg % 10 === 0 ? 50 : 25;
    const dashGap = 4;

    ctx.beginPath();
    if (deg > 0) {
      // above horizon — solid lines
      ctx.moveTo(-halfLen, yOff);
      ctx.lineTo(halfLen, yOff);
    } else {
      // below horizon — dashed
      const segments = Math.floor(halfLen / (dashGap * 2));
      for (let i = 0; i < segments; i++) {
        const x0 = -halfLen + i * dashGap * 2;
        ctx.moveTo(x0, yOff);
        ctx.lineTo(x0 + dashGap, yOff);
      }
      for (let i = 0; i < segments; i++) {
        const x0 = dashGap + i * dashGap * 2;
        ctx.moveTo(x0, yOff);
        ctx.lineTo(x0 + dashGap, yOff);
      }
    }
    ctx.stroke();

    // Labels on every 10 degrees
    if (deg % 10 === 0) {
      ctx.fillText(String(deg), -halfLen - 16, yOff);
      ctx.fillText(String(deg), halfLen + 16, yOff);
    }
  }

  // Horizon line
  const horizonY = pitch * pxPerDeg;
  ctx.strokeStyle = HUD_GREEN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-120, horizonY);
  ctx.lineTo(-30, horizonY);
  ctx.moveTo(30, horizonY);
  ctx.lineTo(120, horizonY);
  ctx.stroke();

  clearShadow(ctx);
  ctx.restore();
}

function drawRollArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  roll: number,
  h: number
) {
  const radius = h * 0.18;
  const arcCy = cy - h * 0.22;
  const ticks = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];

  ctx.save();
  ctx.strokeStyle = HUD_GREEN;
  ctx.fillStyle = HUD_GREEN;
  ctx.lineWidth = 1;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Arc
  ctx.beginPath();
  ctx.arc(cx, arcCy + radius, radius, -Math.PI * 5 / 6, -Math.PI / 6, false);
  ctx.stroke();

  // Tick marks
  for (const t of ticks) {
    const angle = -Math.PI / 2 + degToRad(t);
    const inner = radius - (t % 30 === 0 ? 10 : 6);
    const outer = radius;
    ctx.beginPath();
    ctx.moveTo(
      cx + inner * Math.cos(angle),
      arcCy + radius + inner * Math.sin(angle)
    );
    ctx.lineTo(
      cx + outer * Math.cos(angle),
      arcCy + radius + outer * Math.sin(angle)
    );
    ctx.stroke();
  }

  // Roll pointer (triangle)
  const pAngle = -Math.PI / 2 - degToRad(roll);
  const px = cx + (radius + 5) * Math.cos(pAngle);
  const py = arcCy + radius + (radius + 5) * Math.sin(pAngle);

  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(
    px + 5 * Math.cos(pAngle + 2.5),
    py + 5 * Math.sin(pAngle + 2.5)
  );
  ctx.lineTo(
    px + 5 * Math.cos(pAngle - 2.5),
    py + 5 * Math.sin(pAngle - 2.5)
  );
  ctx.closePath();
  ctx.fill();

  clearShadow(ctx);
  ctx.restore();
}

function drawSpeedTape(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  speedKph: number,
  h: number
) {
  const tapeH = h * 0.4;
  const tapeW = 50;
  const pxPerUnit = tapeH / 60; // 60 km/h visible range
  const top = cy - tapeH / 2;

  ctx.save();

  // Clip region
  ctx.beginPath();
  ctx.rect(x - tapeW, top, tapeW + 10, tapeH);
  ctx.clip();

  ctx.lineWidth = 1;
  ctx.strokeStyle = HUD_GREEN;
  ctx.fillStyle = HUD_GREEN;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + tapeH);
  ctx.stroke();

  // Tick marks
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const startVal = Math.floor(speedKph / 5) * 5 - 30;
  const endVal = startVal + 60;

  for (let val = startVal; val <= endVal; val += 5) {
    if (val < 0) continue;
    const yPos = cy - (val - speedKph) * pxPerUnit;
    const tickLen = val % 10 === 0 ? 12 : 6;

    ctx.beginPath();
    ctx.moveTo(x, yPos);
    ctx.lineTo(x - tickLen, yPos);
    ctx.stroke();

    if (val % 10 === 0) {
      ctx.fillText(String(val), x - tickLen - 4, yPos);
    }
  }

  clearShadow(ctx);
  ctx.restore();

  // Current speed box
  const boxW = 50;
  const boxH = 20;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x - boxW - 4, cy - boxH / 2, boxW, boxH);
  ctx.strokeStyle = HUD_GREEN;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - boxW - 4, cy - boxH / 2, boxW, boxH);

  setHudStyle(ctx, HUD_GREEN, 12, "center", "middle");
  ctx.fillText(String(Math.round(speedKph)), x - boxW / 2 - 4, cy);
  clearShadow(ctx);
}

function drawAltTape(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  alt: number,
  h: number
) {
  const tapeH = h * 0.4;
  const tapeW = 50;
  const pxPerUnit = tapeH / 100; // 100m visible range
  const top = cy - tapeH / 2;

  ctx.save();

  // Clip
  ctx.beginPath();
  ctx.rect(x - 10, top, tapeW + 10, tapeH);
  ctx.clip();

  ctx.lineWidth = 1;
  ctx.strokeStyle = HUD_GREEN;
  ctx.fillStyle = HUD_GREEN;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Vertical line
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + tapeH);
  ctx.stroke();

  // Ticks
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const startVal = Math.floor(alt / 10) * 10 - 50;
  const endVal = startVal + 100;

  for (let val = startVal; val <= endVal; val += 5) {
    if (val < 0) continue;
    const yPos = cy - (val - alt) * pxPerUnit;
    const tickLen = val % 10 === 0 ? 12 : 6;

    ctx.beginPath();
    ctx.moveTo(x, yPos);
    ctx.lineTo(x + tickLen, yPos);
    ctx.stroke();

    if (val % 10 === 0) {
      ctx.fillText(String(val), x + tickLen + 4, yPos);
    }
  }

  clearShadow(ctx);
  ctx.restore();

  // Current altitude box
  const boxW = 50;
  const boxH = 20;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(x + 4, cy - boxH / 2, boxW, boxH);
  ctx.strokeStyle = HUD_GREEN;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4, cy - boxH / 2, boxW, boxH);

  setHudStyle(ctx, HUD_GREEN, 12, "center", "middle");
  ctx.fillText(alt.toFixed(1), x + boxW / 2 + 4, cy);
  clearShadow(ctx);
}

function drawHeadingCompass(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  heading: number,
  w: number
) {
  const stripW = Math.min(w * 0.4, 300);
  const stripH = 20;
  const left = cx - stripW / 2;

  const pxPerDeg = stripW / 60; // 60 deg visible range
  const cardinals: Record<number, string> = {
    0: "N",
    90: "E",
    180: "S",
    270: "W",
  };

  ctx.save();

  // Clip
  ctx.beginPath();
  ctx.rect(left, y, stripW, stripH + 4);
  ctx.clip();

  ctx.lineWidth = 1;
  ctx.strokeStyle = HUD_GREEN;
  ctx.fillStyle = HUD_GREEN;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(left, y + stripH);
  ctx.lineTo(left + stripW, y + stripH);
  ctx.stroke();

  // Ticks
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  for (let offset = -35; offset <= 35; offset++) {
    const deg = normalizeHeading(heading + offset);
    const xPos = cx + offset * pxPerDeg;

    if (deg % 10 === 0) {
      const tickLen = deg % 30 === 0 ? 10 : 5;
      ctx.beginPath();
      ctx.moveTo(xPos, y + stripH);
      ctx.lineTo(xPos, y + stripH - tickLen);
      ctx.stroke();
    }

    const cardinal = cardinals[deg];
    if (cardinal) {
      ctx.font = `bold 11px ${FONT}`;
      ctx.fillText(cardinal, xPos, y + stripH - 10);
      ctx.font = `10px ${FONT}`;
    } else if (deg % 30 === 0) {
      ctx.fillText(String(deg), xPos, y + stripH - 10);
    }
  }

  clearShadow(ctx);
  ctx.restore();

  // Current heading box below strip
  const boxW = 44;
  const boxH = 18;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(cx - boxW / 2, y + stripH + 2, boxW, boxH);
  ctx.strokeStyle = HUD_GREEN;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - boxW / 2, y + stripH + 2, boxW, boxH);

  setHudStyle(ctx, HUD_GREEN, 11, "center", "middle");
  ctx.fillText(
    String(Math.round(normalizeHeading(heading))).padStart(3, "0") + "\u00B0",
    cx,
    y + stripH + 2 + boxH / 2
  );
  clearShadow(ctx);

  // Center marker (triangle)
  ctx.fillStyle = HUD_GREEN;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 1;
  ctx.beginPath();
  ctx.moveTo(cx, y + stripH);
  ctx.lineTo(cx - 4, y + stripH + 3);
  ctx.lineTo(cx + 4, y + stripH + 3);
  ctx.closePath();
  ctx.fill();
  clearShadow(ctx);
}

function drawBatteryHud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  pct: number
) {
  const barW = 200;
  const barH = 10;
  const left = cx - barW / 2;

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(left, y, barW, barH);

  // Fill
  const fillW = (pct / 100) * barW;
  ctx.fillStyle = batColor(pct);
  ctx.fillRect(left, y, fillW, barH);

  // Border
  ctx.strokeStyle = HUD_GREEN;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, y, barW, barH);

  // Label
  setHudStyle(ctx, "#ffffff", 10, "center", "top");
  ctx.fillText(`${Math.round(pct)}%`, cx, y + barH + 3);
  clearShadow(ctx);
}

function drawGpsAndMode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  satellites: number,
  mode: string
) {
  setHudStyle(ctx, HUD_GREEN, 11, "left", "bottom");

  // Simple satellite icon (draw small dots)
  ctx.fillText(`\u2736 ${satellites} SAT`, x, y);
  ctx.fillText(mode, x, y + 16);
  clearShadow(ctx);
}

function drawArmedStatus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  armed: boolean
) {
  const text = armed ? "ARMED" : "DISARMED";
  const color = armed ? ARMED_RED : DISARMED_GREEN;

  setHudStyle(ctx, color, 12, "center", "top");
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(text, cx, y);
  clearShadow(ctx);
}

function drawSignalBars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bars: number
) {
  const barW = 3;
  const gap = 2;
  const maxH = 12;

  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 1;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  for (let i = 0; i < 4; i++) {
    const bh = ((i + 1) / 4) * maxH;
    const bx = x + i * (barW + gap);
    const by = y - bh;
    ctx.fillStyle = i < bars ? HUD_GREEN : "rgba(255,255,255,0.2)";
    ctx.fillRect(bx, by, barW, bh);
  }
  clearShadow(ctx);
}

function drawFlightTimer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  startedAt: number | undefined
) {
  const elapsed = startedAt ? Date.now() - startedAt : 0;
  setHudStyle(ctx, HUD_GREEN, 11, "right", "bottom");
  ctx.fillText(formatTimerFromMs(elapsed), x, y);
  clearShadow(ctx);
}

// ── Main component ──────────────────────────────────────────────

export function OsdOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas to parent size
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    if (
      canvas.width !== Math.floor(rect.width * dpr) ||
      canvas.height !== Math.floor(rect.height * dpr)
    ) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Read telemetry state directly (no hooks — avoids re-renders)
    const tState = useTelemetryStore.getState();
    const dState = useDroneStore.getState();
    const mState = useMissionStore.getState();

    const att = tState.attitude.latest();
    const pos = tState.position.latest();
    const bat = tState.battery.latest();
    const gps = tState.gps.latest();
    const vfr = tState.vfr.latest();

    const pitch = att?.pitch ?? 0;
    const roll = att?.roll ?? 0;
    const heading = pos?.heading ?? vfr?.heading ?? 0;
    const alt = pos?.alt ?? vfr?.alt ?? 0;
    const speedMps = vfr?.groundspeed ?? pos?.groundSpeed ?? 0;
    const speedKph = mpsToKph(speedMps);
    const batteryPct = bat?.remaining ?? 0;
    const satellites = gps?.satellites ?? 0;
    const armed = dState.armState === "armed";
    const mode = dState.flightMode;
    const startedAt = mState.activeMission?.startedAt;

    // Draw OSD elements
    drawPitchLadder(ctx, cx, cy, pitch, roll, h);
    drawRollArc(ctx, cx, cy, roll, h);
    drawCrosshair(ctx, cx, cy);
    drawSpeedTape(ctx, cx - w * 0.25, cy, speedKph, h);
    drawAltTape(ctx, cx + w * 0.25, cy, alt, h);
    drawHeadingCompass(ctx, cx, 30, heading, w);
    drawBatteryHud(ctx, cx, h - 45, batteryPct);
    drawGpsAndMode(ctx, 16, h - 20, satellites, mode);
    drawArmedStatus(ctx, cx, cy + 34, armed);
    drawSignalBars(ctx, w - 80, h - 20, 4);
    drawFlightTimer(ctx, w - 16, h - 20, startedAt);

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 5 }}
    />
  );
}
