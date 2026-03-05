"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { useDroneManager } from "@/stores/drone-manager";
import { useToast } from "@/components/ui/toast";
import { usePanelScroll } from "@/hooks/use-panel-scroll";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Cog,
  Save,
  HardDrive,
  AlertTriangle,
  Play,
  Square,
  Gauge,
  Timer,
  Zap,
} from "lucide-react";

// ── Param Names (module-level const to prevent re-render loops) ─

const PARAM_NAMES = [
  "BF_MOTOR_MIN_THROTTLE",
  "BF_MOTOR_MAX_THROTTLE",
  "BF_MOTOR_MIN_COMMAND",
  "BF_MOTOR_IDLE_PCT",
  "BF_MOTOR_PWM_PROTOCOL",
  "BF_MOTOR_PWM_RATE",
  "BF_GYRO_SYNC_DENOM",
  "BF_PID_PROCESS_DENOM",
] as const;

// ── ESC Protocol definitions ─────────────────────────────────

const ESC_PROTOCOLS = [
  { value: "0", label: "PWM" },
  { value: "1", label: "OneShot125" },
  { value: "2", label: "OneShot42" },
  { value: "3", label: "MultiShot" },
  { value: "4", label: "Brushed" },
  { value: "5", label: "DShot150" },
  { value: "6", label: "DShot300" },
  { value: "7", label: "DShot600" },
  { value: "8", label: "DShot1200" },
  { value: "9", label: "ProShot1000" },
];

const MOTOR_COUNT = 4;

// ── Component ─────────────────────────────────────────────────

export function BfMotorsPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const { isLocked } = useArmedLock();
  const scrollRef = usePanelScroll("bf-motors");
  const [saving, setSaving] = useState(false);

  const {
    params,
    loading,
    error,
    dirtyParams,
    hasRamWrites,
    loadProgress,
    hasLoaded,
    refresh,
    setLocalValue,
    saveAllToRam,
    commitToFlash,
  } = usePanelParams({
    paramNames: [...PARAM_NAMES],
    panelId: "bf-motors",
    autoLoad: true,
  });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

  // Motor test state
  const [motorTestActive, setMotorTestActive] = useState(false);
  const [motorValues, setMotorValues] = useState<number[]>(
    Array(MOTOR_COUNT).fill(0)
  );
  const [masterValue, setMasterValue] = useState(0);
  const [propsRemoved, setPropsRemoved] = useState(false);
  const motorTestIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // ── Derived values ─────────────────────────────────────────

  const p = (name: string, fallback = "0") =>
    String(params.get(name) ?? fallback);
  const set = (name: string, v: string) =>
    setLocalValue(name, Number(v) || 0);

  const escProtocol = params.get("BF_MOTOR_PWM_PROTOCOL") ?? 0;
  const isDshot = escProtocol >= 5 && escProtocol <= 8;
  const isPwmLike = escProtocol <= 3; // PWM, OneShot125, OneShot42, MultiShot

  // Idle percentage: stored as x100 (550 = 5.50%)
  const idleRaw = params.get("BF_MOTOR_IDLE_PCT") ?? 0;
  const idleDisplay = (idleRaw / 100).toFixed(2);

  // Effective PID loop rate
  const gyroSyncDenom = params.get("BF_GYRO_SYNC_DENOM") ?? 1;
  const pidDenom = params.get("BF_PID_PROCESS_DENOM") ?? 1;
  const baseGyroRate = 8000;
  const effectiveGyroRate = baseGyroRate / Math.max(1, gyroSyncDenom);
  const effectivePidRate = effectiveGyroRate / Math.max(1, pidDenom);

  // Format rate for display
  const formatRate = (hz: number) => {
    if (hz >= 1000) return `${(hz / 1000).toFixed(1)}kHz`;
    return `${hz}Hz`;
  };

  // ── Motor test controls ────────────────────────────────────

  const startMotorTest = useCallback(() => {
    if (isLocked) {
      toast("Cannot test motors while armed", "error");
      return;
    }
    setMotorTestActive(true);
    toast("Motor test started. Keep clear of props!", "warning");
  }, [isLocked, toast]);

  const stopMotorTest = useCallback(() => {
    const protocol = getSelectedProtocol();
    if (protocol?.isConnected) {
      // Stop all motors
      for (let i = 0; i < MOTOR_COUNT; i++) {
        protocol.motorTest(i, 0, 0).catch(() => {});
      }
    }
    setMotorTestActive(false);
    setMotorValues(Array(MOTOR_COUNT).fill(0));
    setMasterValue(0);
    if (motorTestIntervalRef.current) {
      clearInterval(motorTestIntervalRef.current);
      motorTestIntervalRef.current = null;
    }
  }, [getSelectedProtocol]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (motorTestIntervalRef.current) {
        clearInterval(motorTestIntervalRef.current);
      }
    };
  }, []);

  const setMotorThrottle = useCallback(
    (motor: number, pct: number) => {
      const protocol = getSelectedProtocol();
      if (!protocol?.isConnected || !motorTestActive) return;

      setMotorValues((prev) => {
        const next = [...prev];
        next[motor] = pct;
        return next;
      });

      protocol.motorTest(motor, pct, 0).catch(() => {});
    },
    [getSelectedProtocol, motorTestActive]
  );

  const setAllMotors = useCallback(
    (pct: number) => {
      const protocol = getSelectedProtocol();
      if (!protocol?.isConnected || !motorTestActive) return;

      setMasterValue(pct);
      setMotorValues(Array(MOTOR_COUNT).fill(pct));

      for (let i = 0; i < MOTOR_COUNT; i++) {
        protocol.motorTest(i, pct, 0).catch(() => {});
      }
    },
    [getSelectedProtocol, motorTestActive]
  );

  // ── Save / Flash ──────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) toast("Saved to flight controller", "success");
    else toast("Some parameters failed to save", "warning");
  }

  async function handleFlash() {
    const ok = await commitToFlash();
    if (ok) toast("Written to flash", "success");
    else toast("Failed to write to flash", "error");
  }

  return (
    <ArmedLockOverlay>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-6">
          <PanelHeader
            title="Motors & ESC"
            subtitle="Motor configuration, ESC protocol, and motor testing"
            icon={<Cog size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={connected}
            error={error}
          />

          {/* ESC Protocol */}
          <Card
            icon={<Zap size={14} />}
            title="ESC Protocol"
            description="Communication protocol between FC and ESCs"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Protocol"
                options={ESC_PROTOCOLS}
                value={String(escProtocol)}
                onChange={(v) => set("BF_MOTOR_PWM_PROTOCOL", v)}
              />
              {isPwmLike && (
                <Input
                  label="PWM Rate"
                  type="number"
                  step="10"
                  min="50"
                  max="32000"
                  unit="Hz"
                  value={p("BF_MOTOR_PWM_RATE", "480")}
                  onChange={(e) => set("BF_MOTOR_PWM_RATE", e.target.value)}
                />
              )}
            </div>
            {isDshot && (
              <p className="text-[10px] text-status-success mt-1">
                DShot is a digital protocol. PWM rate setting does not apply.
              </p>
            )}
          </Card>

          {/* Throttle Configuration */}
          <Card
            icon={<Gauge size={14} />}
            title="Throttle"
            description="Motor throttle range and idle settings"
          >
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Min Throttle"
                type="number"
                step="10"
                min="1000"
                max="2000"
                unit="\u00B5s"
                value={p("BF_MOTOR_MIN_THROTTLE", "1070")}
                onChange={(e) =>
                  set("BF_MOTOR_MIN_THROTTLE", e.target.value)
                }
              />
              <Input
                label="Max Throttle"
                type="number"
                step="10"
                min="1000"
                max="2000"
                unit="\u00B5s"
                value={p("BF_MOTOR_MAX_THROTTLE", "2000")}
                onChange={(e) =>
                  set("BF_MOTOR_MAX_THROTTLE", e.target.value)
                }
              />
              <Input
                label="Min Command"
                type="number"
                step="10"
                min="0"
                max="2000"
                unit="\u00B5s"
                value={p("BF_MOTOR_MIN_COMMAND", "1000")}
                onChange={(e) =>
                  set("BF_MOTOR_MIN_COMMAND", e.target.value)
                }
              />
              <div>
                <Input
                  label={`Idle (${idleDisplay}%)`}
                  type="number"
                  step="10"
                  min="0"
                  max="3000"
                  value={String(idleRaw)}
                  onChange={(e) =>
                    setLocalValue(
                      "BF_MOTOR_IDLE_PCT",
                      Number(e.target.value) || 0
                    )
                  }
                />
                <p className="text-[9px] text-text-tertiary mt-0.5">
                  Value x100 (550 = 5.50%)
                </p>
              </div>
            </div>
          </Card>

          {/* Motor Test */}
          <Card
            icon={<AlertTriangle size={14} />}
            title="Motor Test"
            description="Test individual motors. DISARMED state required."
          >
            {/* Safety warning */}
            <div className="flex items-start gap-2 p-3 bg-status-error/10 border border-status-error/20 rounded">
              <AlertTriangle
                size={16}
                className="text-status-error shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-medium text-status-error">
                  REMOVE ALL PROPELLERS BEFORE TESTING
                </p>
                <p className="text-[10px] text-status-error/80 mt-0.5">
                  Motors will spin when tested. Failure to remove propellers
                  can result in injury or damage.
                </p>
              </div>
            </div>

            {/* Props removed acknowledgment */}
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={propsRemoved}
                onChange={(e) => setPropsRemoved(e.target.checked)}
                className="w-4 h-4 rounded border-border-default bg-bg-tertiary accent-accent-primary"
              />
              <span className="text-xs text-text-secondary">
                I confirm all propellers have been removed
              </span>
            </label>

            {/* Motor controls */}
            {propsRemoved && (
              <div className="space-y-4 mt-3">
                {/* Start/Stop button */}
                <div className="flex items-center gap-2">
                  {!motorTestActive ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Play size={12} />}
                      onClick={startMotorTest}
                      disabled={isLocked || !connected}
                    >
                      Enable Motor Test
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Square size={12} />}
                      onClick={stopMotorTest}
                      className="border-status-error text-status-error"
                    >
                      Stop All Motors
                    </Button>
                  )}
                  {isLocked && (
                    <span className="text-[10px] text-status-error">
                      Disarm to test motors
                    </span>
                  )}
                </div>

                {/* Individual motor sliders */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Array.from({ length: MOTOR_COUNT }, (_, i) => (
                    <div key={i} className="text-center space-y-2">
                      <span className="text-xs font-mono text-text-secondary">
                        Motor {i + 1}
                      </span>
                      <div className="relative mx-auto w-8">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={motorValues[i]}
                          onChange={(e) =>
                            setMotorThrottle(i, Number(e.target.value))
                          }
                          disabled={!motorTestActive}
                          className="w-24 -rotate-90 translate-y-10 origin-center accent-accent-primary disabled:opacity-30"
                          style={{ height: "2rem", marginTop: "2rem", marginBottom: "2rem" }}
                        />
                      </div>
                      <span
                        className={`text-sm font-mono tabular-nums ${
                          motorValues[i] > 0
                            ? "text-status-warning"
                            : "text-text-tertiary"
                        }`}
                      >
                        {motorValues[i]}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Master slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-text-secondary">
                    <span>Master Throttle</span>
                    <span className="font-mono tabular-nums">
                      {masterValue}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterValue}
                    onChange={(e) => setAllMotors(Number(e.target.value))}
                    disabled={!motorTestActive}
                    className="w-full accent-accent-primary disabled:opacity-30"
                  />
                  <div className="flex justify-between text-[8px] text-text-tertiary font-mono">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Timing Configuration */}
          <Card
            icon={<Timer size={14} />}
            title="Timing"
            description="Gyro and PID loop rate configuration"
          >
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Gyro Sync Denom"
                type="number"
                step="1"
                min="1"
                max="32"
                value={p("BF_GYRO_SYNC_DENOM", "1")}
                onChange={(e) => set("BF_GYRO_SYNC_DENOM", e.target.value)}
              />
              <Input
                label="PID Process Denom"
                type="number"
                step="1"
                min="1"
                max="16"
                value={p("BF_PID_PROCESS_DENOM", "1")}
                onChange={(e) =>
                  set("BF_PID_PROCESS_DENOM", e.target.value)
                }
              />
            </div>
            <div className="mt-3 p-2 bg-bg-tertiary rounded space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Base gyro rate</span>
                <span className="font-mono text-text-primary">
                  {formatRate(baseGyroRate)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">
                  Effective gyro rate
                </span>
                <span className="font-mono text-accent-primary">
                  {formatRate(effectiveGyroRate)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">
                  Effective PID loop
                </span>
                <span className="font-mono text-accent-primary font-bold">
                  {formatRate(effectivePidRate)}
                </span>
              </div>
            </div>
          </Card>

          {/* Save */}
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
              <span className="text-[10px] text-text-tertiary">
                Connect a drone to save parameters
              </span>
            )}
            {hasDirty && connected && (
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
