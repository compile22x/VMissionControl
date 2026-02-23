"use client";

import { useFleetStore } from "@/stores/fleet-store";
import { AlertRow } from "@/components/shared/alert-row";
import { Card } from "@/components/ui/card";

export function AlertFeed() {
  const alerts = useFleetStore((s) => s.alerts);
  const acknowledgeAlert = useFleetStore((s) => s.acknowledgeAlert);

  const recent = alerts.slice(0, 10);

  return (
    <Card title="Recent Alerts" padding={false}>
      {recent.length === 0 ? (
        <div className="px-3 py-4 text-xs text-text-tertiary text-center">
          No alerts
        </div>
      ) : (
        <div>
          {recent.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onAcknowledge={acknowledgeAlert}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
