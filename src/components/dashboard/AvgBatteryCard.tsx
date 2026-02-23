"use client";

import { useFleetStore } from "@/stores/fleet-store";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";

export function AvgBatteryCard() {
  const drones = useFleetStore((s) => s.drones);

  const dronesWithBattery = drones.filter((d) => d.battery);
  const avgBattery =
    dronesWithBattery.length > 0
      ? dronesWithBattery.reduce((sum, d) => sum + (d.battery?.remaining ?? 0), 0) /
        dronesWithBattery.length
      : 0;

  return (
    <Card title="Fleet Battery">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-text-secondary">Average</span>
        <span className="text-lg font-mono font-semibold text-text-primary tabular-nums">
          {Math.round(avgBattery)}%
        </span>
      </div>
      <ProgressBar value={avgBattery} showLabel={false} />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-text-tertiary">
          {dronesWithBattery.filter((d) => (d.battery?.remaining ?? 0) < 25).length} low
        </span>
        <span className="text-[10px] text-text-tertiary">
          {dronesWithBattery.length} reporting
        </span>
      </div>
    </Card>
  );
}
