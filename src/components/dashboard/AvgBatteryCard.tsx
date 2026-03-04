"use client";

import { useFleetStore } from "@/stores/fleet-store";
import { useDroneMetadataStore } from "@/stores/drone-metadata-store";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";

export function AvgBatteryCard() {
  const drones = useFleetStore((s) => s.drones);
  const profiles = useDroneMetadataStore((s) => s.profiles);

  const dronesWithBattery = drones.filter((d) => d.battery);
  const avgBattery =
    dronesWithBattery.length > 0
      ? dronesWithBattery.reduce((sum, d) => sum + (d.battery?.remaining ?? 0), 0) /
        dronesWithBattery.length
      : 0;

  const avgVoltage =
    dronesWithBattery.length > 0
      ? dronesWithBattery.reduce((sum, d) => sum + (d.battery?.voltage ?? 0), 0) /
        dronesWithBattery.length
      : 0;

  // Find drone with lowest battery
  const minDrone = dronesWithBattery.length > 0
    ? dronesWithBattery.reduce((min, d) =>
        (d.battery?.remaining ?? 100) < (min.battery?.remaining ?? 100) ? d : min
      )
    : null;

  const minName = minDrone
    ? (profiles[minDrone.id]?.displayName ?? minDrone.name)
    : null;

  return (
    <Card title="Fleet Battery">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[11px] text-text-secondary">Average</span>
          <span className="text-[10px] text-text-tertiary ml-2 font-mono tabular-nums">
            {avgVoltage.toFixed(1)}V
          </span>
        </div>
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
      {minDrone && minDrone.battery && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-default">
          <span className="text-[10px] text-text-tertiary truncate mr-2">
            Lowest: {minName}
          </span>
          <span className={`text-[10px] font-mono tabular-nums ${
            (minDrone.battery.remaining) < 25 ? "text-status-error" : "text-text-secondary"
          }`}>
            {Math.round(minDrone.battery.remaining)}% / {minDrone.battery.voltage.toFixed(1)}V
          </span>
        </div>
      )}
    </Card>
  );
}
