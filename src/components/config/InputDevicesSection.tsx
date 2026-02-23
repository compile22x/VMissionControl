"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { useInputStore } from "@/stores/input-store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const AXIS_LABELS = ["Roll", "Pitch", "Throttle", "Yaw"] as const;

function AxisBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(-1, Math.min(1, value));
  const percent = ((clamped + 1) / 2) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-16 font-mono">{label}</span>
      <div className="flex-1 h-3 bg-bg-tertiary border border-border-default relative">
        {/* center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border-default" />
        {/* value bar */}
        <div
          className="absolute top-0 bottom-0 bg-accent-primary/60 transition-all duration-75"
          style={{
            left: clamped >= 0 ? "50%" : `${percent}%`,
            width: `${Math.abs(clamped) * 50}%`,
          }}
        />
        {/* value indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent-primary transition-all duration-75"
          style={{ left: `${percent}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-tertiary w-10 text-right tabular-nums">
        {clamped.toFixed(2)}
      </span>
    </div>
  );
}

export function InputDevicesSection() {
  const { activeController, axes, deadzone, expo, setDeadzone, setExpo } =
    useInputStore();
  const { toast } = useToast();

  const isConnected = activeController !== "none";

  const controllerLabel: Record<string, string> = {
    keyboard: "Keyboard",
    gamepad: "Gamepad Connected",
    rc_tx: "RC Transmitter",
    none: "No controller detected",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Input Devices</h2>

      {/* Detected Controllers */}
      <Card title="Detected Controllers">
        <div className="flex items-center gap-2">
          <StatusDot status={isConnected ? "online" : "offline"} />
          <span
            className={cn(
              "text-xs",
              isConnected ? "text-status-success" : "text-text-tertiary"
            )}
          >
            {controllerLabel[activeController]}
          </span>
        </div>
      </Card>

      {/* Axis Mapping */}
      <Card title="Axis Mapping">
        <div className="space-y-3">
          {AXIS_LABELS.map((label, i) => (
            <AxisBar key={label} label={label} value={axes[i]} />
          ))}
        </div>
      </Card>

      {/* Deadzone & Expo */}
      <Card title="Tuning">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-secondary">Deadzone</label>
              <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
                {deadzone.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.01}
              max={0.2}
              step={0.01}
              value={deadzone}
              onChange={(e) => setDeadzone(parseFloat(e.target.value))}
              className="w-full h-1 bg-bg-tertiary appearance-none cursor-pointer accent-accent-primary"
            />
            <div className="flex justify-between text-[9px] text-text-tertiary font-mono">
              <span>0.01</span>
              <span>0.20</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-secondary">Expo Curve</label>
              <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
                {expo.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={expo}
              onChange={(e) => setExpo(parseFloat(e.target.value))}
              className="w-full h-1 bg-bg-tertiary appearance-none cursor-pointer accent-accent-primary"
            />
            <div className="flex justify-between text-[9px] text-text-tertiary font-mono">
              <span>0.0</span>
              <span>1.0</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Test Mode */}
      <Button
        variant="secondary"
        onClick={() => toast("Gamepad test mode not available in demo", "info")}
      >
        Test Mode
      </Button>
    </div>
  );
}
