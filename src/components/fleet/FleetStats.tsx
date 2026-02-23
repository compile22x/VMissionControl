"use client";

import { useFleetStore } from "@/stores/fleet-store";
import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";

export function FleetStats() {
  const drones = useFleetStore((s) => s.drones);
  const alerts = useFleetStore((s) => s.alerts);

  const total = drones.length;
  const active = drones.filter((d) => d.status === "in_mission" || d.status === "online").length;
  const dronesWithBattery = drones.filter((d) => d.battery);
  const avgBattery =
    dronesWithBattery.length > 0
      ? Math.round(
          dronesWithBattery.reduce((s, d) => s + (d.battery?.remaining ?? 0), 0) /
            dronesWithBattery.length
        )
      : 0;
  const unackedAlerts = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3">
      <Card>
        <DataValue label="Total Drones" value={total} />
      </Card>
      <Card>
        <DataValue label="Active" value={active} />
      </Card>
      <Card>
        <DataValue label="Avg Battery" value={avgBattery} unit="%" />
      </Card>
      <Card>
        <DataValue label="Alerts" value={unackedAlerts} />
      </Card>
    </div>
  );
}
