"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDroneManager } from "@/stores/drone-manager";
import { useFleetStore } from "@/stores/fleet-store";
import { DroneListPanel } from "@/components/dashboard/DroneListPanel";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DroneDetailPanel } from "@/components/dashboard/DroneDetailPanel";
import { DroneLogsPanel } from "@/components/drone-detail/DroneLogsPanel";
import { EmptyFleetState } from "@/components/dashboard/EmptyFleetState";

export default function DashboardPage() {
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const selectDrone = useDroneManager((s) => s.selectDrone);
  const drones = useFleetStore((s) => s.drones);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [logsCollapsed, setLogsCollapsed] = useState(false);

  if (drones.length === 0) {
    return <EmptyFleetState />;
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <DroneListPanel collapsed={panelCollapsed} onToggleCollapse={() => setPanelCollapsed((p) => !p)} />
      {selectedDroneId ? (
        <>
          <DroneDetailPanel droneId={selectedDroneId} onClose={() => selectDrone(null)} />
          {logsCollapsed && (
            <div className="w-10 shrink-0 flex flex-col items-center h-full border-l border-border-default bg-bg-secondary">
              <button
                onClick={() => setLogsCollapsed(false)}
                className="p-2 mt-2 text-text-tertiary hover:text-text-primary transition-colors"
                title="Expand logs panel"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          )}
          <div className={`w-80 shrink-0 flex flex-col h-full border-l border-border-default bg-bg-secondary ${logsCollapsed ? "hidden" : ""}`}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default flex-shrink-0">
              <button
                onClick={() => setLogsCollapsed(true)}
                className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
                title="Collapse logs panel"
              >
                <ChevronRight size={14} />
              </button>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Flight Logs
              </span>
            </div>
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <DroneLogsPanel droneId={selectedDroneId} />
            </div>
          </div>
        </>
      ) : (
        <DashboardOverview />
      )}
    </div>
  );
}
