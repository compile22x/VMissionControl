"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Satellite,
  Compass,
  Activity,
  RotateCw,
  Gauge,
  Battery,
  Cog,
  Radio,
  Video,
  MapPin,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { ReactNode } from "react";

type CheckStatus = "pending" | "checking" | "pass" | "warning" | "fail";

interface CheckItem {
  id: string;
  name: string;
  icon: ReactNode;
  status: CheckStatus;
  result: string;
}

const INITIAL_CHECKS: CheckItem[] = [
  { id: "gps", name: "GPS Lock", icon: <Satellite size={14} />, status: "pending", result: "" },
  { id: "compass", name: "Compass Calibration", icon: <Compass size={14} />, status: "pending", result: "" },
  { id: "accel", name: "Accelerometer", icon: <Activity size={14} />, status: "pending", result: "" },
  { id: "gyro", name: "Gyroscope", icon: <RotateCw size={14} />, status: "pending", result: "" },
  { id: "baro", name: "Barometer", icon: <Gauge size={14} />, status: "pending", result: "" },
  { id: "battery", name: "Battery", icon: <Battery size={14} />, status: "pending", result: "" },
  { id: "motor", name: "Motor Test", icon: <Cog size={14} />, status: "pending", result: "" },
  { id: "radio", name: "Radio Link", icon: <Radio size={14} />, status: "pending", result: "" },
  { id: "video", name: "Video Feed", icon: <Video size={14} />, status: "pending", result: "" },
  { id: "geofence", name: "Geofence", icon: <MapPin size={14} />, status: "pending", result: "" },
];

const CHECK_RESULTS: Record<string, { status: CheckStatus; result: string }> = {
  gps: { status: "pass", result: "17 satellites" },
  compass: { status: "pass", result: "Calibrated" },
  accel: { status: "pass", result: "Normal" },
  gyro: { status: "pass", result: "Normal" },
  baro: { status: "pass", result: "1013 hPa" },
  battery: { status: "pass", result: "82%" },
  motor: { status: "pass", result: "All responding" },
  radio: { status: "pass", result: "RSSI 220" },
  video: { status: "warning", result: "No signal" },
  geofence: { status: "warning", result: "Not configured" },
};

interface HealthCheckWizardProps {
  onComplete?: () => void;
}

export function HealthCheckWizard({ onComplete }: HealthCheckWizardProps) {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setIsRunning(true);

    const runChecks = async () => {
      for (let i = 0; i < INITIAL_CHECKS.length; i++) {
        const checkId = INITIAL_CHECKS[i].id;

        // Set to checking
        setChecks((prev) =>
          prev.map((c) => (c.id === checkId ? { ...c, status: "checking" } : c))
        );

        // Wait simulated check time
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));

        // Set result
        const result = CHECK_RESULTS[checkId];
        setChecks((prev) =>
          prev.map((c) =>
            c.id === checkId
              ? { ...c, status: result.status, result: result.result }
              : c
          )
        );
      }

      setIsRunning(false);
      setIsDone(true);
      onComplete?.();
    };

    runChecks();
  }, [onComplete]);

  const warnings = checks.filter((c) => c.status === "warning");
  const failures = checks.filter((c) => c.status === "fail");
  const passes = checks.filter((c) => c.status === "pass");

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="text-xs text-text-secondary">
        {isRunning ? "Running pre-flight checks..." : "Pre-flight check complete"}
      </div>

      <div className="space-y-1">
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-center gap-3 px-3 py-2 border border-border-default bg-bg-tertiary/30"
          >
            <span className="text-text-tertiary">{check.icon}</span>
            <span className="text-xs text-text-primary flex-1">{check.name}</span>

            {/* Status */}
            <div className="flex items-center gap-2">
              {check.status === "pending" && (
                <span className="text-[10px] text-text-tertiary font-mono">--</span>
              )}
              {check.status === "checking" && (
                <span className="flex items-center gap-1 text-[10px] text-accent-primary font-mono">
                  <Loader2 size={10} className="animate-spin" />
                  checking...
                </span>
              )}
              {check.status === "pass" && (
                <span className="flex items-center gap-1 text-[10px] text-status-success font-mono">
                  <Check size={10} />
                  {check.result}
                </span>
              )}
              {check.status === "warning" && (
                <span className="flex items-center gap-1 text-[10px] text-status-warning font-mono">
                  <AlertTriangle size={10} />
                  {check.result}
                </span>
              )}
              {check.status === "fail" && (
                <span className="flex items-center gap-1 text-[10px] text-status-error font-mono">
                  <AlertTriangle size={10} />
                  {check.result}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {isDone && (
        <div
          className={cn(
            "px-3 py-2 border text-xs",
            failures.length > 0
              ? "border-status-error bg-status-error/10 text-status-error"
              : warnings.length > 0
                ? "border-status-warning bg-status-warning/10 text-status-warning"
                : "border-status-success bg-status-success/10 text-status-success"
          )}
        >
          {failures.length > 0
            ? `${failures.length} check(s) failed. Resolve before flight.`
            : warnings.length > 0
              ? `${passes.length} passed, ${warnings.length} warning(s). Review before flight.`
              : "All checks passed. Ready for flight."}
        </div>
      )}
    </div>
  );
}
