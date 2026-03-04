"use client";

import { useEffect, useCallback } from "react";
import {
  Check,
  X,
  Circle,
  SkipForward,
  RotateCcw,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useChecklistStore,
  type ChecklistCategory,
  type ChecklistItem,
  type ChecklistItemStatus,
} from "@/stores/checklist-store";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useSensorHealthStore } from "@/stores/sensor-health-store";
import { useMissionStore } from "@/stores/mission-store";
import { useGeofenceStore } from "@/stores/geofence-store";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: ChecklistCategory[] = ["hardware", "software", "environment", "mission"];

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  hardware: "Hardware",
  software: "Software",
  environment: "Environment",
  mission: "Mission",
};

function StatusIcon({ status }: { status: ChecklistItemStatus }) {
  switch (status) {
    case "pass":
      return <Check size={12} className="text-status-success shrink-0" />;
    case "fail":
      return <X size={12} className="text-status-error shrink-0" />;
    case "skipped":
      return <SkipForward size={10} className="text-text-tertiary shrink-0" />;
    default:
      return <Circle size={10} className="text-text-tertiary shrink-0" />;
  }
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const toggleManualItem = useChecklistStore((s) => s.toggleManualItem);
  const skipItem = useChecklistStore((s) => s.skipItem);

  const isManual = item.type === "manual";
  const isClickable = isManual;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 group",
        isClickable && "cursor-pointer hover:bg-bg-tertiary transition-colors",
      )}
      onClick={isClickable ? () => toggleManualItem(item.id) : undefined}
    >
      <StatusIcon status={item.status} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[11px]",
              item.status === "pass" && "text-text-secondary line-through",
              item.status === "fail" && "text-status-error",
              item.status === "pending" && "text-text-primary",
              item.status === "skipped" && "text-text-tertiary line-through",
            )}
          >
            {item.label}
          </span>
          {item.type === "auto" && (
            <span className="text-[8px] font-mono uppercase text-text-tertiary bg-bg-tertiary px-1 py-0.5">
              AUTO
            </span>
          )}
        </div>
      </div>
      {item.displayValue && (
        <span
          className={cn(
            "text-[10px] font-mono tabular-nums",
            item.status === "pass" && "text-status-success",
            item.status === "fail" && "text-status-error",
            item.status === "pending" && "text-text-tertiary",
          )}
        >
          {item.displayValue}
        </span>
      )}
      {/* Skip button for manual items */}
      {isManual && item.status !== "pass" && (
        <Tooltip content="Skip this check" position="left">
          <button
            onClick={(e) => {
              e.stopPropagation();
              skipItem(item.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-text-tertiary hover:text-text-secondary transition-all"
          >
            <SkipForward size={10} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

export function PreFlightChecklist({ className }: { className?: string }) {
  const items = useChecklistStore((s) => s.items);
  const sessionId = useChecklistStore((s) => s.sessionId);
  const startSession = useChecklistStore((s) => s.startSession);
  const resetSession = useChecklistStore((s) => s.resetSession);
  const updateAutoItem = useChecklistStore((s) => s.updateAutoItem);
  const isReadyToArm = useChecklistStore((s) => s.isReadyToArm);
  const getProgress = useChecklistStore((s) => s.getProgress);
  const getCategoryProgress = useChecklistStore((s) => s.getCategoryProgress);

  // Telemetry subscriptions for auto-checks
  const battery = useTelemetryStore((s) => s.battery);
  const gps = useTelemetryStore((s) => s.gps);
  const ekf = useTelemetryStore((s) => s.ekf);
  const _version = useTelemetryStore((s) => s._version);
  const healthyCount = useSensorHealthStore((s) => s.getHealthySensorCount());
  const totalPresent = useSensorHealthStore((s) => s.getTotalPresentCount());
  const waypoints = useMissionStore((s) => s.waypoints);
  const geofenceEnabled = useGeofenceStore((s) => s.enabled);

  // Auto-check runner: updates auto items based on current telemetry
  const runAutoChecks = useCallback(() => {
    // Battery checks
    const latestBattery = battery.latest();
    if (latestBattery) {
      updateAutoItem(
        "battery-level",
        latestBattery.remaining > 20 ? "pass" : "fail",
        `${Math.round(latestBattery.remaining)}%`,
      );
      updateAutoItem(
        "battery-voltage",
        latestBattery.voltage > 10.5 ? "pass" : "fail",
        `${latestBattery.voltage.toFixed(1)}V`,
      );
    }

    // GPS checks
    const latestGps = gps.latest();
    if (latestGps) {
      updateAutoItem(
        "gps-fix",
        latestGps.fixType >= 3 ? "pass" : "fail",
        latestGps.fixType >= 3 ? "3D Fix" : latestGps.fixType === 2 ? "2D" : "No Fix",
      );
      updateAutoItem(
        "gps-sats",
        latestGps.satellites >= 8 ? "pass" : "fail",
        `${latestGps.satellites} sats`,
      );
    }

    // EKF check
    const latestEkf = ekf.latest();
    if (latestEkf) {
      // EKF flags: check velocity and position variance flags are OK
      const ekfOk = latestEkf.velocityVariance < 1.0 && latestEkf.posHorizVariance < 1.0;
      updateAutoItem("ekf-ok", ekfOk ? "pass" : "fail");
    }

    // Sensor health
    if (totalPresent > 0) {
      const allHealthy = healthyCount === totalPresent;
      updateAutoItem(
        "sensors-healthy",
        allHealthy ? "pass" : "fail",
        `${healthyCount}/${totalPresent}`,
      );
    }

    // Pre-arm checks: pass if sensors look good (firmware pre-arm is checked via PreArmChecks component separately)
    // For the checklist, we treat this as pass if other software checks pass
    if (totalPresent > 0 && healthyCount === totalPresent) {
      updateAutoItem("prearm-pass", "pass");
    } else if (totalPresent > 0) {
      updateAutoItem("prearm-pass", "fail");
    }

    // Mission checks
    updateAutoItem(
      "flight-plan",
      waypoints.length > 0 ? "pass" : "fail",
      waypoints.length > 0 ? `${waypoints.length} wpts` : "None",
    );
    updateAutoItem(
      "geofence-set",
      geofenceEnabled ? "pass" : "fail",
      geofenceEnabled ? "Enabled" : "Disabled",
    );
  }, [battery, gps, ekf, healthyCount, totalPresent, waypoints.length, geofenceEnabled, updateAutoItem]);

  // Run auto-checks on telemetry updates (debounced by _version)
  useEffect(() => {
    if (!sessionId) return;
    runAutoChecks();
  }, [sessionId, _version, runAutoChecks, waypoints.length, geofenceEnabled, healthyCount]);

  // Auto-start session on mount if none active
  useEffect(() => {
    if (!sessionId) {
      startSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = getProgress();
  const progressPct = progress.total > 0 ? (progress.checked / progress.total) * 100 : 0;
  const ready = isReadyToArm();

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default">
        <Shield size={14} className="text-text-secondary shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex-1">
          Pre-Flight Checklist
        </span>
        <Tooltip content="Reset all checks" position="left">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              resetSession();
              startSession();
            }}
          >
            <RotateCcw size={10} />
          </Button>
        </Tooltip>
      </div>

      {/* Progress bar */}
      <div className="px-3 py-2 border-b border-border-default">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-text-tertiary">
            {progress.checked}/{progress.total} items
          </span>
          {progress.failed > 0 && (
            <span className="text-[10px] font-mono text-status-error">
              {progress.failed} failed
            </span>
          )}
        </div>
        <ProgressBar
          value={progressPct}
          color={
            progress.failed > 0
              ? "var(--alt-status-error)"
              : progressPct === 100
                ? "var(--alt-status-success)"
                : "var(--alt-accent-primary)"
          }
        />
      </div>

      {/* Category sections */}
      <div className="flex-1 overflow-y-auto">
        {CATEGORY_ORDER.map((category) => {
          const catItems = items.filter((i) => i.category === category);
          const catProgress = getCategoryProgress(category);
          return (
            <CollapsibleSection
              key={category}
              title={CATEGORY_LABELS[category]}
              defaultOpen
              count={catProgress.checked}
              trailing={
                <span className="text-[9px] font-mono text-text-tertiary">
                  {catProgress.checked}/{catProgress.total}
                </span>
              }
            >
              <div className="pb-1">
                {catItems.map((item) => (
                  <ChecklistRow key={item.id} item={item} />
                ))}
              </div>
            </CollapsibleSection>
          );
        })}
      </div>

      {/* Ready to arm indicator */}
      <div
        className={cn(
          "mx-3 mb-3 mt-2 px-3 py-2 border flex items-center gap-2",
          ready
            ? "bg-status-success/10 border-status-success/30"
            : "bg-status-warning/10 border-status-warning/30",
        )}
      >
        {ready ? (
          <ShieldCheck size={16} className="text-status-success shrink-0" />
        ) : (
          <ShieldAlert size={16} className="text-status-warning shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "text-xs font-semibold",
              ready ? "text-status-success" : "text-status-warning",
            )}
          >
            {ready ? "READY TO ARM" : "NOT READY"}
          </span>
          {!ready && (
            <p className="text-[10px] text-text-tertiary mt-0.5">
              {progress.total - progress.checked} item{progress.total - progress.checked !== 1 ? "s" : ""} remaining
              {progress.failed > 0 && `, ${progress.failed} failed`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
