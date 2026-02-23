"use client";

import { useFleetStore } from "@/stores/fleet-store";
import { Card } from "@/components/ui/card";
import { AlertTriangle, AlertCircle } from "lucide-react";

export function AlertsCountCard() {
  const alerts = useFleetStore((s) => s.alerts);

  const unacked = alerts.filter((a) => !a.acknowledged);
  const critical = unacked.filter((a) => a.severity === "critical").length;
  const warning = unacked.filter((a) => a.severity === "warning").length;

  return (
    <Card title="Alerts">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-text-secondary">Unacknowledged</span>
        <span className="text-lg font-mono font-semibold text-text-primary tabular-nums">
          {unacked.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={12} className="text-status-error" />
            <span className="text-xs text-text-secondary">Critical</span>
          </div>
          <span className="text-xs font-mono text-status-error tabular-nums">{critical}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={12} className="text-status-warning" />
            <span className="text-xs text-text-secondary">Warning</span>
          </div>
          <span className="text-xs font-mono text-status-warning tabular-nums">{warning}</span>
        </div>
      </div>
    </Card>
  );
}
