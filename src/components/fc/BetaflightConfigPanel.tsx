"use client";

import { useState, useMemo, useCallback } from "react";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useDroneManager } from "@/stores/drone-manager";
import { useToast } from "@/components/ui/toast";
import { usePanelScroll } from "@/hooks/use-panel-scroll";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { PanelHeader } from "./PanelHeader";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Save,
  HardDrive,
  ToggleRight,
  Shield,
  Bell,
} from "lucide-react";
import { FEATURE_FLAG } from "@/lib/protocol/msp/msp-constants";

// ── Param Names (module-level const to avoid re-render loops) ─

const PARAM_NAMES = [
  "BF_FEATURE_MASK",
  "BF_AUTO_DISARM_DELAY",
  "BF_SMALL_ANGLE",
  "BF_BEEPER_DISABLED_MASK",
] as const;

// ── Feature definitions ──────────────────────────────────────

interface FeatureDef {
  bit: number;
  label: string;
  description: string;
}

const FEATURE_DEFS: FeatureDef[] = [
  { bit: FEATURE_FLAG.RX_PPM, label: "RX_PPM", description: "PPM receiver input" },
  { bit: FEATURE_FLAG.VBAT, label: "VBAT", description: "Battery voltage monitoring" },
  { bit: FEATURE_FLAG.RX_SERIAL, label: "RX_SERIAL", description: "Serial receiver (SBUS, CRSF, etc.)" },
  { bit: FEATURE_FLAG.MOTOR_STOP, label: "MOTOR_STOP", description: "Stop motors when armed at zero throttle" },
  { bit: FEATURE_FLAG.SOFTSERIAL, label: "SOFTSERIAL", description: "Software serial ports" },
  { bit: FEATURE_FLAG.GPS, label: "GPS", description: "GPS support" },
  { bit: FEATURE_FLAG.SONAR, label: "SONAR", description: "Sonar/rangefinder" },
  { bit: FEATURE_FLAG.TELEMETRY, label: "TELEMETRY", description: "Telemetry output (FrSky, CRSF, etc.)" },
  { bit: FEATURE_FLAG.LED_STRIP, label: "LED_STRIP", description: "Addressable LED strip" },
  { bit: FEATURE_FLAG.OSD, label: "OSD", description: "On-screen display" },
  { bit: FEATURE_FLAG.AIRMODE, label: "AIRMODE", description: "Airmode (full PID authority at zero throttle)" },
  { bit: FEATURE_FLAG.RX_SPI, label: "RX_SPI", description: "SPI receiver (built-in)" },
  { bit: FEATURE_FLAG.ESC_SENSOR, label: "ESC_SENSOR", description: "ESC telemetry sensor" },
  { bit: FEATURE_FLAG.ANTI_GRAVITY, label: "ANTI_GRAVITY", description: "Anti-gravity (I-term boost on throttle changes)" },
  { bit: FEATURE_FLAG.DYNAMIC_FILTER, label: "DYNAMIC_FILTER", description: "Dynamic notch filter" },
];

// ── Beeper definitions ───────────────────────────────────────

interface BeeperDef {
  bit: number;
  label: string;
}

const BEEPER_DEFS: BeeperDef[] = [
  { bit: 0, label: "GYRO_CALIBRATED" },
  { bit: 1, label: "RX_LOST" },
  { bit: 2, label: "RX_LOST_LANDING" },
  { bit: 3, label: "DISARMING" },
  { bit: 4, label: "ARMING" },
  { bit: 5, label: "ARMING_GPS_FIX" },
  { bit: 6, label: "BAT_CRIT_LOW" },
  { bit: 7, label: "BAT_LOW" },
  { bit: 8, label: "GPS_STATUS" },
  { bit: 9, label: "RX_SET" },
  { bit: 10, label: "ACC_CALIBRATION" },
  { bit: 11, label: "ACC_CALIBRATION_FAIL" },
  { bit: 12, label: "READY_BEEP" },
  { bit: 13, label: "MULTI_BEEPS" },
  { bit: 14, label: "DISARM_REPEAT" },
  { bit: 15, label: "ARMED" },
  { bit: 16, label: "SYSTEM_INIT" },
  { bit: 17, label: "USB" },
  { bit: 18, label: "BLACKBOX_ERASE" },
  { bit: 19, label: "CRASH_FLIP" },
  { bit: 20, label: "CAM_CONNECTION_OPEN" },
  { bit: 21, label: "CAM_CONNECTION_CLOSE" },
  { bit: 22, label: "RC_SMOOTHING_INIT_FAIL" },
];

// ── Component ─────────────────────────────────────────────────

export function BetaflightConfigPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const scrollRef = usePanelScroll("bf-config");
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
    panelId: "bf-config",
    autoLoad: true,
  });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

  // ── Feature mask helpers ───────────────────────────────────

  const featureMask = params.get("BF_FEATURE_MASK") ?? 0;

  const toggleFeature = useCallback(
    (bit: number) => {
      const mask = 1 << bit;
      const current = params.get("BF_FEATURE_MASK") ?? 0;
      const next = current & mask ? current & ~mask : current | mask;
      setLocalValue("BF_FEATURE_MASK", next >>> 0);
    },
    [params, setLocalValue]
  );

  // ── Beeper mask helpers (inverted: bit=1 means disabled) ───

  const beeperMask = params.get("BF_BEEPER_DISABLED_MASK") ?? 0;

  const toggleBeeper = useCallback(
    (bit: number) => {
      const mask = 1 << bit;
      const current = params.get("BF_BEEPER_DISABLED_MASK") ?? 0;
      // Inverted: checking the box means the beeper is ENABLED (bit is cleared)
      const next = current & mask ? current & ~mask : current | mask;
      setLocalValue("BF_BEEPER_DISABLED_MASK", next >>> 0);
    },
    [params, setLocalValue]
  );

  // Count enabled features and beepers
  const enabledFeatureCount = useMemo(
    () => FEATURE_DEFS.filter((f) => (featureMask & (1 << f.bit)) !== 0).length,
    [featureMask]
  );
  const enabledBeeperCount = useMemo(
    () => BEEPER_DEFS.filter((b) => (beeperMask & (1 << b.bit)) === 0).length,
    [beeperMask]
  );

  const p = (name: string, fallback = "0") =>
    String(params.get(name) ?? fallback);
  const set = (name: string, v: string) =>
    setLocalValue(name, Number(v) || 0);

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
            title="Configuration"
            subtitle="Feature toggles, arming settings, and beeper configuration"
            icon={<Settings size={16} />}
            loading={loading}
            loadProgress={loadProgress}
            hasLoaded={hasLoaded}
            onRead={refresh}
            connected={connected}
            error={error}
          />

          {/* Feature Toggles */}
          <Card
            icon={<ToggleRight size={14} />}
            title={`Feature Toggles (${enabledFeatureCount}/${FEATURE_DEFS.length} enabled)`}
            description="Enable or disable firmware features (BF_FEATURE_MASK)"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {FEATURE_DEFS.map((feat) => {
                const checked = (featureMask & (1 << feat.bit)) !== 0;
                return (
                  <label
                    key={feat.bit}
                    className="flex items-start gap-2 cursor-pointer group p-1.5 rounded hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFeature(feat.bit)}
                      className="w-3.5 h-3.5 mt-0.5 rounded border-border-default bg-bg-tertiary accent-accent-primary"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-text-primary group-hover:text-accent-primary transition-colors">
                        {feat.label}
                      </span>
                      <p className="text-[10px] text-text-tertiary leading-tight">
                        {feat.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-text-tertiary font-mono">
              Mask: {featureMask} (0x
              {featureMask.toString(16).toUpperCase().padStart(8, "0")})
            </div>
          </Card>

          {/* Arming Configuration */}
          <Card
            icon={<Shield size={14} />}
            title="Arming"
            description="Auto-disarm timeout and small angle limit"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Auto-disarm delay"
                type="number"
                step="1"
                min="0"
                max="60"
                unit="s"
                value={p("BF_AUTO_DISARM_DELAY", "5")}
                onChange={(e) => set("BF_AUTO_DISARM_DELAY", e.target.value)}
              />
              <Input
                label="Small angle limit"
                type="number"
                step="1"
                min="0"
                max="180"
                unit="deg"
                value={p("BF_SMALL_ANGLE", "25")}
                onChange={(e) => set("BF_SMALL_ANGLE", e.target.value)}
              />
            </div>
            <p className="text-[10px] text-text-tertiary mt-2">
              Auto-disarm: seconds of inactivity before motors auto-disarm (0 = disabled).
              Small angle: maximum tilt angle in degrees that allows arming.
            </p>
          </Card>

          {/* Beeper Configuration */}
          <Card
            icon={<Bell size={14} />}
            title={`Beeper Configuration (${enabledBeeperCount}/${BEEPER_DEFS.length} enabled)`}
            description="Toggle individual beeper conditions (BF_BEEPER_DISABLED_MASK is inverted: bit=1 disables)"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {BEEPER_DEFS.map((beep) => {
                // Inverted: bit=1 in mask means DISABLED, so checkbox enabled = bit NOT set
                const isEnabled = (beeperMask & (1 << beep.bit)) === 0;
                return (
                  <label
                    key={beep.bit}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleBeeper(beep.bit)}
                      className="w-3.5 h-3.5 rounded border-border-default bg-bg-tertiary accent-accent-primary"
                    />
                    <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
                      {beep.label}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-text-tertiary font-mono">
              Disabled mask: {beeperMask} (0x
              {beeperMask.toString(16).toUpperCase().padStart(8, "0")})
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
