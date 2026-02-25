/**
 * @module hud-draw
 * @description Shared canvas drawing functions for the HUD overlay and
 * Overview artificial horizon. Extracted from OsdOverlay.tsx so both the
 * transparent OSD (fly page) and the sky/ground HUD (overview tab) can
 * share the same instrument renderers.
 * @license GPL-3.0-only
 */

import { degToRad, normalizeHeading } from "@/lib/telemetry-utils";

// ── Colors ──────────────────────────────────────────────────────
export const HUD_GREEN = "#00ff41";
export const ARMED_RED = "#ef4444";
export const DISARMED_GREEN = "#22c55e";
export const BAT_GREEN = "#22c55e";
export const BAT_AMBER = "#f59e0b";
export const BAT_RED = "#ef4444";
export const SHADOW = "rgba(0,0,0,0.8)";
export const FONT = '"JetBrains Mono", monospace';

// ── Sky/Ground palette (Glass Cockpit) ──────────────────────────
export const SKY_TOP = "#0a1428";
export const SKY_HORIZON = "#1a4a7a";
export const GROUND_HORIZON = "#3a4a2a";
export const GROUND_BOTTOM = "#1a2510";
export const HORIZON_LINE = "rgba(255, 255, 255, 0.3)";

// ── Utility ─────────────────────────────────────────────────────

export function batColor(pct: number): string {
  if (pct > 50) return BAT_GREEN;
  if (pct > 25) return BAT_AMBER;
  return BAT_RED;
}

export function formatTimerFromMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Drawing helpers ─────────────────────────────────────────────

export function setHudStyle(
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

export function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// ── Sky/Ground gradient (artificial horizon background) ─────────

/**
 * Draw sky/ground gradient background that tilts with pitch and roll.
 * Uses Mission Planner hud.html gradient approach adapted for dark theme.
 */
export function drawSkyGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pitch: number,
  roll: number
) {
  const cx = w / 2;
  const cy = h / 2;
  const ladderH = h * 0.4;
  const pxPerDeg = ladderH / 40; // match pitch ladder scale

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-degToRad(roll));

  // Pitch offset in pixels
  const pitchOffset = pitch * pxPerDeg;

  // Gradient spans 2x canvas height for full rotation coverage
  const gradH = h * 2;
  const gradientOffset = Math.max(0, Math.min(1, 0.5 + pitchOffset / gradH));

  const grad = ctx.createLinearGradient(0, -gradH / 2, 0, gradH / 2);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(Math.max(0, gradientOffset - 0.001), SKY_HORIZON);
  grad.addColorStop(gradientOffset, GROUND_HORIZON);
  grad.addColorStop(1, GROUND_BOTTOM);

  ctx.fillStyle = grad;

  // Fill rect covering diagonal — ensures no gaps at any rotation angle
  const diag = Math.sqrt(w * w + h * h);
  ctx.fillRect(-diag, -diag, diag * 2, diag * 2);

  // Horizon line at the boundary
  ctx.strokeStyle = HORIZON_LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-diag, pitchOffset);
  ctx.lineTo(diag, pitchOffset);
  ctx.stroke();

  ctx.restore();
}

// ── Instruments ─────────────────────────────────────────────────

export function drawCrosshair(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
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

export function drawPitchLadder(
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

export function drawRollArc(
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

export function drawSpeedTape(
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

export function drawAltTape(
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

export function drawHeadingCompass(
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

export function drawBatteryHud(
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

export function drawGpsAndMode(
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

export function drawArmedStatus(
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

export function drawSignalBars(
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

export function drawFlightTimer(
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
