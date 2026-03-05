"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "./PanelHeader";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { SlidersHorizontal, Save, RotateCcw, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelScroll } from "@/hooks/use-panel-scroll";

// ── Constants ──

const ADJUSTMENT_SLOT_COUNT = 4;

/** Adjustment function names (Betaflight MSP_ADJUSTMENT_RANGES) */
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
];

const AUX_CHANNELS = [
  { value: "0", label: "AUX 1" },
  { value: "1", label: "AUX 2" },
  { value: "2", label: "AUX 3" },
  { value: "3", label: "AUX 4" },
  { value: "4", label: "AUX 5" },
  { value: "5", label: "AUX 6" },
  { value: "6", label: "AUX 7" },
  { value: "7", label: "AUX 8" },
  { value: "8", label: "AUX 9" },
  { value: "9", label: "AUX 10" },
  { value: "10", label: "AUX 11" },
  { value: "11", label: "AUX 12" },
];

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

  const p = (name: string, fallback = 0) => String(params.get(name) ?? fallback);
  const set = (name: string, v: string) => setLocalValue(name, Number(v) || 0);

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

        {/* Adjustment slots table */}
        <div className="border border-border-default bg-bg-secondary">
          {/* Header */}
          <div className="grid grid-cols-[40px_60px_90px_140px_160px_90px] gap-2 px-4 py-2 border-b border-border-default text-[10px] text-text-tertiary font-medium">
            <span>#</span>
            <span>Enable</span>
            <span>Channel</span>
            <span>Range</span>
            <span>Function</span>
            <span>Via</span>
          </div>

          {/* Rows */}
          {Array.from({ length: ADJUSTMENT_SLOT_COUNT }, (_, i) => {
            const enabled = Number(params.get(`BF_ADJ${i}_ENABLE`) ?? 0) === 1;
            return (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[40px_60px_90px_140px_160px_90px] gap-2 px-4 py-2 items-center border-b border-border-default/50",
                  !enabled && "opacity-50",
                )}
              >
                {/* Slot number */}
                <span className="text-xs font-mono text-text-secondary">{i}</span>

                {/* Enable checkbox */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => setLocalValue(`BF_ADJ${i}_ENABLE`, enabled ? 0 : 1)}
                    className="accent-accent-primary"
                  />
                </label>

                {/* Channel select */}
                <Select
                  options={AUX_CHANNELS}
                  value={p(`BF_ADJ${i}_CHANNEL`)}
                  onChange={(v) => set(`BF_ADJ${i}_CHANNEL`, v)}
                  disabled={!enabled}
                />

                {/* Range (low - high PWM) */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={900}
                    max={2100}
                    step={25}
                    value={params.get(`BF_ADJ${i}_RANGE_LOW`) ?? 1500}
                    onChange={(e) => setLocalValue(`BF_ADJ${i}_RANGE_LOW`, Number(e.target.value) || 900)}
                    disabled={!enabled}
                    className={cn(
                      "w-16 h-6 px-1 bg-bg-tertiary border text-[10px] font-mono text-text-primary text-right",
                      "focus:outline-none focus:border-accent-primary transition-colors",
                      dirtyParams.has(`BF_ADJ${i}_RANGE_LOW`) ? "border-status-warning" : "border-border-default",
                    )}
                  />
                  <span className="text-[10px] text-text-tertiary">-</span>
                  <input
                    type="number"
                    min={900}
                    max={2100}
                    step={25}
                    value={params.get(`BF_ADJ${i}_RANGE_HIGH`) ?? 2100}
                    onChange={(e) => setLocalValue(`BF_ADJ${i}_RANGE_HIGH`, Number(e.target.value) || 2100)}
                    disabled={!enabled}
                    className={cn(
                      "w-16 h-6 px-1 bg-bg-tertiary border text-[10px] font-mono text-text-primary text-right",
                      "focus:outline-none focus:border-accent-primary transition-colors",
                      dirtyParams.has(`BF_ADJ${i}_RANGE_HIGH`) ? "border-status-warning" : "border-border-default",
                    )}
                  />
                </div>

                {/* Function select */}
                <Select
                  options={ADJUSTMENT_FUNCTIONS}
                  value={p(`BF_ADJ${i}_FUNCTION`)}
                  onChange={(v) => set(`BF_ADJ${i}_FUNCTION`, v)}
                  disabled={!enabled}
                />

                {/* Via channel */}
                <Select
                  options={AUX_CHANNELS}
                  value={p(`BF_ADJ${i}_VIA_CHANNEL`)}
                  onChange={(v) => set(`BF_ADJ${i}_VIA_CHANNEL`, v)}
                  disabled={!enabled}
                />
              </div>
            );
          })}
        </div>

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
