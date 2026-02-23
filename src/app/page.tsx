"use client";

import { useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { DroneListPanel } from "@/components/dashboard/DroneListPanel";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DroneDetailPanel } from "@/components/dashboard/DroneDetailPanel";

export default function DashboardPage() {
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const selectDrone = useDroneManager((s) => s.selectDrone);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <DroneListPanel collapsed={panelCollapsed} onToggleCollapse={() => setPanelCollapsed((p) => !p)} />
      {selectedDroneId ? (
        <DroneDetailPanel droneId={selectedDroneId} onClose={() => selectDrone(null)} />
      ) : (
        <DashboardOverview />
      )}
    </div>
  );
}
