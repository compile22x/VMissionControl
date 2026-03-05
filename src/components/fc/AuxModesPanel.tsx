"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { usePanelScroll } from "@/hooks/use-panel-scroll";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import {
  ToggleRight,
  Save,
  HardDrive,
  Plus,
  Trash2,
  Radio,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

interface ModeRange {
  boxId: number;
  auxChannel: number; // 0-based (AUX1 = 0)
  rangeStart: number; // step value (0-48)
  rangeEnd: number; // step value (0-48)
}

// ── Constants ─────────────────────────────────────────────────

/** Convert step to PWM: PWM = 900 + step * 25 */
function stepToPwm(step: number): number {
  return 900 + step * 25;
}

/** Convert PWM to step: step = (PWM - 900) / 25 */
function pwmToStep(pwm: number): number {
  return Math.round((pwm - 900) / 25);
}

const AUX_CHANNEL_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i),
  label: `AUX ${i + 1}`,
}));

// Default Betaflight mode names (used when we can't read from FC)
const DEFAULT_MODE_NAMES = [
  "ARM", "ANGLE", "HORIZON", "ANTI GRAVITY", "MAG", "HEADFREE",
  "HEADADJ", "CAMSTAB", "PASSTHRU", "BEEPERON", "LEDLOW",
  "CALIB", "OSD", "TELEMETRY", "SERVO1", "SERVO2", "SERVO3",
  "BLACKBOX", "FAILSAFE", "AIRMODE", "3D", "FPV ANGLE MIX",
  "BLACKBOX ERASE", "CAMERA CONTROL 1", "CAMERA CONTROL 2",
  "CAMERA CONTROL 3", "FLIPOVERAFTERCRASH", "PREARM",
  "BEEP GPS SATELLITE COUNT", "VTX PIT MODE", "USER1", "USER2",
  "USER3", "USER4", "PID AUDIO", "PARALYZE", "GPS RESCUE",
  "ACRO TRAINER", "VTX CONTROL DISABLE", "LAUNCH CONTROL",
  "MSP OVERRIDE", "STICK COMMANDS DISABLE", "BEEPER MUTE",
];

const MAX_RANGES = 20; // Betaflight supports up to 20 mode ranges

// ── Component ─────────────────────────────────────────────────

export function AuxModesPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const { firmwareType } = useFirmwareCapabilities();
  const { isLocked } = useArmedLock();
  const scrollRef = usePanelScroll("aux-modes");

  const [modeNames, setModeNames] = useState<string[]>(DEFAULT_MODE_NAMES);
  const [ranges, setRanges] = useState<ModeRange[]>([]);
  const [originalRanges, setOriginalRanges] = useState<ModeRange[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);

  const isBetaflight = firmwareType === "betaflight";
  const connected = !!getSelectedProtocol();

  // Dirty detection
  const isDirty = useMemo(() => {
    if (ranges.length !== originalRanges.length) return true;
    return ranges.some((r, i) => {
      const o = originalRanges[i];
      return (
        r.boxId !== o.boxId ||
        r.auxChannel !== o.auxChannel ||
        r.rangeStart !== o.rangeStart ||
        r.rangeEnd !== o.rangeEnd
      );
    });
  }, [ranges, originalRanges]);

  useUnsavedGuard(isDirty);

  // RC channel data for live preview
  const rcBuffer = useTelemetryStore((s) => s.rc);
  const latestRc = rcBuffer.latest();

  // ── Read from FC ──────────────────────────────────────────

  const readFromFc = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol || !protocol.isConnected) {
      setError("Not connected to flight controller");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Read box names (MSP_BOXNAMES = 116)
      // These are returned as semicolon-separated string in the payload
      const boxNamesResult = await protocol.getParameter("BF_BOX_NAMES");
      if (boxNamesResult.value === -1) {
        // Virtual param not available, use defaults
      } else {
        // In our adapter, BF_BOX_NAMES would need special handling.
        // For now we use defaults since MSP_BOXNAMES returns raw string data.
      }

      // Read mode ranges (MSP_MODE_RANGES = 34)
      // Each range: 4 bytes: boxId, auxChannel, startStep, endStep
      const rangeResult = await protocol.getParameter("BF_MODE_RANGE_COUNT");
      const rangeCount =
        rangeResult.value >= 0 ? rangeResult.value : MAX_RANGES;

      const loadedRanges: ModeRange[] = [];
      for (let i = 0; i < rangeCount; i++) {
        try {
          const boxIdResult = await protocol.getParameter(
            `BF_MODE_RANGE_${i}_BOX_ID`
          );
          const auxResult = await protocol.getParameter(
            `BF_MODE_RANGE_${i}_AUX`
          );
          const startResult = await protocol.getParameter(
            `BF_MODE_RANGE_${i}_START`
          );
          const endResult = await protocol.getParameter(
            `BF_MODE_RANGE_${i}_END`
          );

          // Only include ranges that are configured (start < end and boxId >= 0)
          if (
            boxIdResult.value >= 0 &&
            startResult.value < endResult.value
          ) {
            loadedRanges.push({
              boxId: boxIdResult.value,
              auxChannel: auxResult.value,
              rangeStart: startResult.value,
              rangeEnd: endResult.value,
            });
          }
        } catch {
          // Skip unreadable ranges
        }
      }

      setRanges(loadedRanges);
      setOriginalRanges(loadedRanges.map((r) => ({ ...r })));
      setHasLoaded(true);
      toast("Loaded auxiliary mode configuration", "success");
    } catch {
      // Fallback: generate demo ranges for a usable panel
      const demoRanges: ModeRange[] = [
        { boxId: 0, auxChannel: 0, rangeStart: pwmToStep(1700), rangeEnd: pwmToStep(2100) }, // ARM on AUX1 1700-2100
        { boxId: 1, auxChannel: 1, rangeStart: pwmToStep(1300), rangeEnd: pwmToStep(1700) }, // ANGLE on AUX2 1300-1700
        { boxId: 19, auxChannel: 0, rangeStart: pwmToStep(900), rangeEnd: pwmToStep(2100) }, // AIRMODE on AUX1 900-2100
        { boxId: 36, auxChannel: 2, rangeStart: pwmToStep(1800), rangeEnd: pwmToStep(2100) }, // GPS RESCUE on AUX3
      ];
      setRanges(demoRanges);
      setOriginalRanges(demoRanges.map((r) => ({ ...r })));
      setHasLoaded(true);
      toast("Loaded default mode ranges (unable to read from FC)", "info");
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol, toast]);

  // Auto-read on mount
  const readRef = useRef(readFromFc);
  readRef.current = readFromFc;
  useEffect(() => {
    readRef.current();
  }, []);

  // ── Save to FC ────────────────────────────────────────────

  const saveToFc = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol || !protocol.isConnected) return;

    setSaving(true);
    try {
      // Send each range via MSP_SET_MODE_RANGE (35)
      for (let i = 0; i < MAX_RANGES; i++) {
        const range = ranges[i];
        if (range) {
          await protocol.setParameter(`BF_MODE_RANGE_${i}_BOX_ID`, range.boxId);
          await protocol.setParameter(`BF_MODE_RANGE_${i}_AUX`, range.auxChannel);
          await protocol.setParameter(`BF_MODE_RANGE_${i}_START`, range.rangeStart);
          await protocol.setParameter(`BF_MODE_RANGE_${i}_END`, range.rangeEnd);
        } else {
          // Clear unused slot
          await protocol.setParameter(`BF_MODE_RANGE_${i}_BOX_ID`, 0);
          await protocol.setParameter(`BF_MODE_RANGE_${i}_AUX`, 0);
          await protocol.setParameter(`BF_MODE_RANGE_${i}_START`, 0);
          await protocol.setParameter(`BF_MODE_RANGE_${i}_END`, 0);
        }
      }

      setOriginalRanges(ranges.map((r) => ({ ...r })));
      setShowFlash(true);
      toast("Saved to flight controller", "success");
    } catch {
      toast("Failed to save mode ranges", "error");
    } finally {
      setSaving(false);
    }
  }, [getSelectedProtocol, ranges, toast]);

  // ── Flash ─────────────────────────────────────────────────

  const commitFlash = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol || !protocol.isConnected) return;

    try {
      const result = await protocol.commitParamsToFlash();
      if (result.success) {
        setShowFlash(false);
        toast("Written to flash", "success");
      } else {
        toast("Failed to write to flash", "error");
      }
    } catch {
      toast("Failed to write to flash", "error");
    }
  }, [getSelectedProtocol, toast]);

  // ── Range manipulation ─────────────────────────────────────

  const addRange = useCallback(
    (boxId: number) => {
      if (ranges.length >= MAX_RANGES) {
        toast("Maximum ranges reached (20)", "warning");
        return;
      }
      setRanges((prev) => [
        ...prev,
        {
          boxId,
          auxChannel: 0,
          rangeStart: pwmToStep(1700),
          rangeEnd: pwmToStep(2100),
        },
      ]);
    },
    [ranges.length, toast]
  );

  const removeRange = useCallback((index: number) => {
    setRanges((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateRange = useCallback(
    (index: number, partial: Partial<ModeRange>) => {
      setRanges((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...partial };
        return next;
      });
    },
    []
  );

  // ── Group ranges by boxId ──────────────────────────────────

  const rangesByMode = useMemo(() => {
    const map = new Map<number, { range: ModeRange; index: number }[]>();
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const list = map.get(r.boxId) ?? [];
      list.push({ range: r, index: i });
      map.set(r.boxId, list);
    }
    return map;
  }, [ranges]);

  // All modes (active + inactive)
  const allModes = useMemo(() => {
    const activeBoxIds = new Set(ranges.map((r) => r.boxId));
    const active = Array.from(activeBoxIds).sort((a, b) => a - b);
    const inactive = modeNames
      .map((_, i) => i)
      .filter((i) => !activeBoxIds.has(i));
    return { active, inactive };
  }, [ranges, modeNames]);

  // Mode name options for "Add Mode" selector
  const addModeOptions = useMemo(
    () =>
      allModes.inactive.map((id) => ({
        value: String(id),
        label: modeNames[id] ?? `Mode ${id}`,
      })),
    [allModes.inactive, modeNames]
  );

  const [addModeId, setAddModeId] = useState("0");

  return (
    <ArmedLockOverlay>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl space-y-6">
          <PanelHeader
            title="Auxiliary Modes"
            subtitle="Configure mode activation via AUX channel PWM ranges"
            icon={<ToggleRight size={16} />}
            loading={loading}
            loadProgress={null}
            hasLoaded={hasLoaded}
            onRead={readFromFc}
            connected={connected}
            error={error}
          />

          {/* Live RC channel preview */}
          {hasLoaded && latestRc && (
            <Card
              icon={<Radio size={14} />}
              title="Live RC Channels"
              description="Current AUX channel PWM values"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }, (_, i) => {
                  const chIndex = i + 4; // AUX1 = channel 5 (index 4)
                  const pwm = latestRc.channels[chIndex] ?? 0;
                  const pct = pwm > 0 ? ((pwm - 900) / 1200) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-text-secondary">
                          AUX {i + 1}
                        </span>
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
            </Card>
          )}

          {/* Active modes */}
          {hasLoaded && allModes.active.length > 0 && (
            <div className="space-y-3">
              {allModes.active.map((boxId) => {
                const modeRanges = rangesByMode.get(boxId) ?? [];
                const modeName = modeNames[boxId] ?? `Mode ${boxId}`;

                return (
                  <Card
                    key={boxId}
                    icon={<ToggleRight size={14} />}
                    title={modeName}
                    description={`Box ID ${boxId}`}
                  >
                    <div className="space-y-3">
                      {modeRanges.map(({ range, index }) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-28">
                              <Select
                                label="Channel"
                                options={AUX_CHANNEL_OPTIONS}
                                value={String(range.auxChannel)}
                                onChange={(v) =>
                                  updateRange(index, {
                                    auxChannel: Number(v),
                                  })
                                }
                              />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between text-[10px] text-text-secondary">
                                <span>
                                  {stepToPwm(range.rangeStart)} \u00B5s
                                </span>
                                <span>
                                  {stepToPwm(range.rangeEnd)} \u00B5s
                                </span>
                              </div>
                              <RangeSlider
                                start={range.rangeStart}
                                end={range.rangeEnd}
                                onChange={(start, end) =>
                                  updateRange(index, {
                                    rangeStart: start,
                                    rangeEnd: end,
                                  })
                                }
                                activePwm={
                                  latestRc
                                    ? latestRc.channels[
                                        range.auxChannel + 4
                                      ] ?? 0
                                    : 0
                                }
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 size={12} />}
                              onClick={() => removeRange(index)}
                              disabled={isLocked}
                            />
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Plus size={12} />}
                        onClick={() => addRange(boxId)}
                        disabled={isLocked || ranges.length >= MAX_RANGES}
                      >
                        Add Range
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Add new mode */}
          {hasLoaded && addModeOptions.length > 0 && (
            <Card
              icon={<Plus size={14} />}
              title="Add Mode"
              description="Assign a new mode to an AUX channel"
            >
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Select
                    label="Mode"
                    options={addModeOptions}
                    value={addModeId}
                    onChange={setAddModeId}
                    searchable
                    searchPlaceholder="Search modes..."
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={12} />}
                  onClick={() => addRange(Number(addModeId))}
                  disabled={isLocked || ranges.length >= MAX_RANGES}
                >
                  Add
                </Button>
              </div>
            </Card>
          )}

          {/* No modes loaded */}
          {hasLoaded && allModes.active.length === 0 && (
            <div className="text-center py-8 text-text-tertiary text-xs">
              No mode ranges configured. Add a mode above to get started.
            </div>
          )}

          {/* Save buttons */}
          <div className="flex items-center gap-3 pt-2 pb-4">
            <Button
              variant="primary"
              size="lg"
              icon={<Save size={14} />}
              disabled={!isDirty || !connected || isLocked}
              loading={saving}
              onClick={saveToFc}
            >
              Save to Flight Controller
            </Button>
            {showFlash && (
              <Button
                variant="secondary"
                size="lg"
                icon={<HardDrive size={14} />}
                onClick={commitFlash}
              >
                Write to Flash
              </Button>
            )}
            {!connected && (
              <span className="text-[10px] text-text-tertiary">
                Connect a drone to save parameters
              </span>
            )}
            {isDirty && connected && (
              <span className="text-[10px] text-status-warning">
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>
    </ArmedLockOverlay>
  );
}

// ── Range Slider Component ────────────────────────────────────

function RangeSlider({
  start,
  end,
  onChange,
  activePwm,
}: {
  start: number; // step value 0-48
  end: number;
  onChange: (start: number, end: number) => void;
  activePwm: number; // live channel PWM for indicator
}) {
  const totalSteps = 48; // 900-2100 in steps of 25
  const startPct = (start / totalSteps) * 100;
  const endPct = (end / totalSteps) * 100;
  const activePct =
    activePwm > 0 ? (pwmToStep(Math.min(2100, Math.max(900, activePwm))) / totalSteps) * 100 : -1;
  const isInRange =
    activePwm > 0 &&
    activePwm >= stepToPwm(start) &&
    activePwm <= stepToPwm(end);

  return (
    <div className="relative h-6 select-none">
      {/* Track background */}
      <div className="absolute top-2 left-0 right-0 h-2 bg-bg-tertiary rounded-full" />

      {/* Active range highlight */}
      <div
        className={`absolute top-2 h-2 rounded-full transition-colors ${
          isInRange ? "bg-status-success/60" : "bg-accent-primary/40"
        }`}
        style={{
          left: `${startPct}%`,
          width: `${endPct - startPct}%`,
        }}
      />

      {/* Live channel indicator */}
      {activePct >= 0 && (
        <div
          className={`absolute top-1 w-0.5 h-4 rounded-full ${
            isInRange ? "bg-status-success" : "bg-text-tertiary"
          }`}
          style={{ left: `${activePct}%` }}
        />
      )}

      {/* Start thumb */}
      <input
        type="range"
        min={0}
        max={totalSteps}
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
        max={totalSteps}
        value={end}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (v > start) onChange(start, v);
        }}
        className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
        style={{ pointerEvents: "auto" }}
      />

      {/* PWM labels */}
      <div className="absolute -bottom-3 left-0 right-0 flex justify-between text-[8px] text-text-tertiary font-mono">
        <span>900</span>
        <span>1500</span>
        <span>2100</span>
      </div>
    </div>
  );
}

// ── Card Component ────────────────────────────────────────────

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-accent-primary">{icon}</span>
        <div>
          <h2 className="text-sm font-medium text-text-primary">{title}</h2>
          <p className="text-[10px] text-text-tertiary">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
