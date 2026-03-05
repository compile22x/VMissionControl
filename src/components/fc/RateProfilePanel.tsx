"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "./PanelHeader";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { Gauge, Save, RotateCcw, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelScroll } from "@/hooks/use-panel-scroll";

// ── Param names (module-level const for stable reference) ──

const PARAM_NAMES = [
  "BF_RC_RATE",
  "BF_RC_EXPO",
  "BF_ROLL_RATE",
  "BF_PITCH_RATE",
  "BF_YAW_RATE",
  "BF_RC_YAW_EXPO",
  "BF_RC_YAW_RATE",
  "BF_THROTTLE_MID",
  "BF_THROTTLE_EXPO",
] as const;

const paramNames = [...PARAM_NAMES];

// ── Rate curve calculation (Betaflight formula) ──

function calcBetaflightRate(
  rcRate: number,
  expo: number,
  superRate: number,
  rcCommand: number,
): number {
  const rcRate_ = rcRate / 100;
  const expo_ = expo / 100;
  const superRate_ = superRate / 100;

  const absRc = Math.abs(rcCommand);
  const expoPower = absRc * absRc * absRc * expo_ + absRc * (1 - expo_);
  let angleRate = 200.0 * rcRate_ * expoPower;

  if (superRate_ > 0) {
    const rcFactor = 1.0 / (1.0 - absRc * superRate_);
    angleRate *= rcFactor;
  }

  return angleRate * Math.sign(rcCommand);
}

// ── Rate curve SVG renderer ──

const CURVE_W = 280;
const CURVE_H = 160;
const CURVE_PAD = 28;

interface CurveData {
  label: string;
  color: string;
  rcRate: number;
  expo: number;
  superRate: number;
}

function RateCurvePreview({ curves }: { curves: CurveData[] }) {
  const maxRate = useMemo(() => {
    let max = 0;
    for (const c of curves) {
      const r = Math.abs(calcBetaflightRate(c.rcRate, c.expo, c.superRate, 1.0));
      if (r > max) max = r;
    }
    return Math.max(max, 100); // minimum Y axis of 100 deg/s
  }, [curves]);

  const plotW = CURVE_W - CURVE_PAD * 2;
  const plotH = CURVE_H - CURVE_PAD * 2;

  return (
    <div className="border border-border-default bg-bg-tertiary/30 p-2">
      <svg width={CURVE_W} height={CURVE_H} className="block">
        {/* Axes */}
        <line
          x1={CURVE_PAD} y1={CURVE_H - CURVE_PAD}
          x2={CURVE_W - CURVE_PAD} y2={CURVE_H - CURVE_PAD}
          stroke="var(--color-border-default)" strokeWidth={1}
        />
        <line
          x1={CURVE_PAD} y1={CURVE_PAD}
          x2={CURVE_PAD} y2={CURVE_H - CURVE_PAD}
          stroke="var(--color-border-default)" strokeWidth={1}
        />

        {/* Axis labels */}
        <text x={CURVE_W / 2} y={CURVE_H - 4} textAnchor="middle" className="text-[8px] fill-text-tertiary">
          Stick %
        </text>
        <text x={8} y={CURVE_H / 2} textAnchor="middle" className="text-[8px] fill-text-tertiary" transform={`rotate(-90, 8, ${CURVE_H / 2})`}>
          deg/s
        </text>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={`h-${frac}`}
            x1={CURVE_PAD}
            y1={CURVE_H - CURVE_PAD - plotH * frac}
            x2={CURVE_W - CURVE_PAD}
            y2={CURVE_H - CURVE_PAD - plotH * frac}
            stroke="var(--color-border-default)" strokeWidth={0.5} strokeDasharray="2,3"
          />
        ))}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={`v-${frac}`}
            x1={CURVE_PAD + plotW * frac}
            y1={CURVE_PAD}
            x2={CURVE_PAD + plotW * frac}
            y2={CURVE_H - CURVE_PAD}
            stroke="var(--color-border-default)" strokeWidth={0.5} strokeDasharray="2,3"
          />
        ))}

        {/* Y axis ticks */}
        {[0, 0.5, 1].map((frac) => (
          <text
            key={`yt-${frac}`}
            x={CURVE_PAD - 3}
            y={CURVE_H - CURVE_PAD - plotH * frac + 3}
            textAnchor="end"
            className="text-[7px] fill-text-tertiary font-mono"
          >
            {Math.round(maxRate * frac)}
          </text>
        ))}

        {/* X axis ticks */}
        {[0, 50, 100].map((pct) => (
          <text
            key={`xt-${pct}`}
            x={CURVE_PAD + plotW * (pct / 100)}
            y={CURVE_H - CURVE_PAD + 12}
            textAnchor="middle"
            className="text-[7px] fill-text-tertiary font-mono"
          >
            {pct}
          </text>
        ))}

        {/* Curves */}
        {curves.map((c) => {
          const points: string[] = [];
          const steps = 50;
          for (let i = 0; i <= steps; i++) {
            const rc = i / steps;
            const rate = Math.abs(calcBetaflightRate(c.rcRate, c.expo, c.superRate, rc));
            const x = CURVE_PAD + (rc * plotW);
            const y = CURVE_H - CURVE_PAD - (rate / maxRate) * plotH;
            points.push(`${x},${y}`);
          }
          return (
            <polyline
              key={c.label}
              points={points.join(" ")}
              fill="none"
              stroke={c.color}
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-3 mt-1 px-1">
        {curves.map((c) => {
          const maxDeg = Math.abs(calcBetaflightRate(c.rcRate, c.expo, c.superRate, 1.0));
          return (
            <div key={c.label} className="flex items-center gap-1">
              <div className="w-2 h-0.5" style={{ backgroundColor: c.color }} />
              <span className="text-[9px] text-text-secondary">
                {c.label}: {Math.round(maxDeg)} deg/s
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Panel ──

export function RateProfilePanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const scrollRef = usePanelScroll("rate-profiles");

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash, revertAll,
  } = usePanelParams({ paramNames, panelId: "rate-profiles", autoLoad: true });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

  const p = (name: string, fallback = 0) => params.get(name) ?? fallback;

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

  // Build curve data for preview
  const curves: CurveData[] = useMemo(() => [
    {
      label: "Roll",
      color: "#3A82FF",
      rcRate: p("BF_RC_RATE"),
      expo: p("BF_RC_EXPO"),
      superRate: p("BF_ROLL_RATE"),
    },
    {
      label: "Pitch",
      color: "#22c55e",
      rcRate: p("BF_RC_RATE"),
      expo: p("BF_RC_EXPO"),
      superRate: p("BF_PITCH_RATE"),
    },
    {
      label: "Yaw",
      color: "#f59e0b",
      rcRate: p("BF_RC_YAW_RATE", 100),
      expo: p("BF_RC_YAW_EXPO"),
      superRate: p("BF_YAW_RATE"),
    },
  ], [params]);

  // Slider row renderer
  function renderSlider(param: string, label: string, min: number, max: number, step: number, unit?: string) {
    const value = p(param);
    const isDirty = dirtyParams.has(param);
    return (
      <div key={param} className="grid grid-cols-[140px_1fr_70px] items-center gap-3">
        <div>
          <span className="text-xs text-text-secondary">{label}</span>
          <span className="text-[9px] text-text-tertiary block font-mono">{param}</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min={min} max={max} step={step}
            value={value}
            onChange={(e) => setLocalValue(param, parseFloat(e.target.value))}
            className="w-full h-1.5 bg-bg-tertiary appearance-none cursor-pointer accent-accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-[8px] text-text-tertiary font-mono mt-0.5">
            <span>{min}</span>
            <span>{max}{unit ? ` ${unit}` : ""}</span>
          </div>
        </div>
        <input
          type="number"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => setLocalValue(param, parseFloat(e.target.value) || 0)}
          className={cn(
            "w-full h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary text-right",
            "focus:outline-none focus:border-accent-primary transition-colors",
            isDirty ? "border-status-warning" : "border-border-default",
          )}
        />
      </div>
    );
  }

  return (
    <ArmedLockOverlay>
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-6">
        <PanelHeader
          title="Rate Profiles"
          subtitle="Betaflight rate curve configuration"
          icon={<Gauge size={16} />}
          loading={loading}
          loadProgress={loadProgress}
          hasLoaded={hasLoaded}
          onRead={refresh}
          connected={connected}
          error={error}
        />

        {/* Main layout: controls + curve preview */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          {/* Left: Rate controls */}
          <div className="space-y-6">
            {/* Roll / Pitch rates */}
            <div className="border border-border-default bg-bg-secondary p-4">
              <h2 className="text-sm font-medium text-text-primary mb-3">Roll / Pitch</h2>
              <div className="space-y-3">
                {renderSlider("BF_RC_RATE", "RC Rate", 0, 255, 1)}
                {renderSlider("BF_RC_EXPO", "RC Expo", 0, 100, 1)}
                {renderSlider("BF_ROLL_RATE", "Roll Rate", 0, 255, 1)}
                {renderSlider("BF_PITCH_RATE", "Pitch Rate", 0, 255, 1)}
              </div>
            </div>

            {/* Yaw rates */}
            <div className="border border-border-default bg-bg-secondary p-4">
              <h2 className="text-sm font-medium text-text-primary mb-3">Yaw</h2>
              <div className="space-y-3">
                {renderSlider("BF_RC_YAW_RATE", "RC Rate (Yaw)", 0, 255, 1)}
                {renderSlider("BF_RC_YAW_EXPO", "RC Expo (Yaw)", 0, 100, 1)}
                {renderSlider("BF_YAW_RATE", "Yaw Rate", 0, 255, 1)}
              </div>
            </div>

            {/* Throttle */}
            <div className="border border-border-default bg-bg-secondary p-4">
              <h2 className="text-sm font-medium text-text-primary mb-3">Throttle</h2>
              <div className="space-y-3">
                {renderSlider("BF_THROTTLE_MID", "Mid", 0, 100, 1, "%")}
                {renderSlider("BF_THROTTLE_EXPO", "Expo", 0, 100, 1)}
              </div>
            </div>
          </div>

          {/* Right: Rate curve preview */}
          <div className="space-y-3">
            <div className="border border-border-default bg-bg-secondary p-3">
              <h2 className="text-sm font-medium text-text-primary mb-2">Rate Curve Preview</h2>
              <RateCurvePreview curves={curves} />
            </div>
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
