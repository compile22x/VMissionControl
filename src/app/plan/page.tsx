"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useMissionStore } from "@/stores/mission-store";
import { useFleetStore } from "@/stores/fleet-store";
import { MissionEditor } from "@/components/planner/MissionEditor";
import { WaypointList } from "@/components/planner/WaypointList";
import { WaypointEditorModal } from "@/components/planner/WaypointEditorModal";
import { GeofenceEditor } from "@/components/planner/GeofenceEditor";
import { DispatchConfirmDialog } from "@/components/planner/DispatchConfirmDialog";
import { useToast } from "@/components/ui/toast";
import { Tabs } from "@/components/ui/tabs";
import { randomId } from "@/lib/utils";
import type { SuiteType, Waypoint } from "@/lib/types";

const PlannerMap = dynamic(
  () => import("@/components/planner/PlannerMap").then((m) => m.PlannerMap),
  { ssr: false }
);

const PANEL_TABS = [
  { id: "mission", label: "Mission" },
  { id: "waypoints", label: "Waypoints" },
  { id: "geofence", label: "Geofence" },
];

export default function MissionPlannerPage() {
  const { waypoints, addWaypoint, removeWaypoint, updateWaypoint, createMission, clearMission } =
    useMissionStore();
  const drones = useFleetStore((s) => s.drones);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("mission");
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [showDispatch, setShowDispatch] = useState(false);

  // Geofence state
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceType, setGeofenceType] = useState("circle");
  const [geofenceMaxAlt, setGeofenceMaxAlt] = useState("120");
  const [geofenceAction, setGeofenceAction] = useState("RTL");

  // Dispatch state
  const [pendingMissionName, setPendingMissionName] = useState("");
  const [pendingDroneId, setPendingDroneId] = useState("");
  const [pendingSuiteType, setPendingSuiteType] = useState<SuiteType | undefined>(undefined);

  const selectedDrone = useMemo(
    () => drones.find((d) => d.id === pendingDroneId) ?? null,
    [drones, pendingDroneId]
  );

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      const wp: Waypoint = {
        id: randomId(),
        lat,
        lon,
        alt: 50,
        command: "WAYPOINT",
      };
      addWaypoint(wp);
    },
    [addWaypoint]
  );

  const handleWaypointSelect = (id: string) => {
    setSelectedWaypointId(id);
    const wp = waypoints.find((w) => w.id === id);
    if (wp) setEditingWaypoint(wp);
  };

  const handleWaypointSave = (id: string, update: Partial<Waypoint>) => {
    updateWaypoint(id, update);
    setEditingWaypoint(null);
  };

  const handleCreateMission = (name: string, droneId: string, suiteType?: SuiteType) => {
    setPendingMissionName(name);
    setPendingDroneId(droneId);
    setPendingSuiteType(suiteType);
    createMission(name, droneId, suiteType);
  };

  const handleDispatchOpen = () => {
    setShowDispatch(true);
  };

  const handleDispatchConfirm = () => {
    setShowDispatch(false);
    toast("Mission dispatched successfully", "success");
  };

  const handleClear = () => {
    clearMission();
    setSelectedWaypointId(null);
    setEditingWaypoint(null);
    toast("Mission cleared", "info");
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Map — 65% */}
      <div className="flex-[65] relative">
        <PlannerMap
          waypoints={waypoints}
          onMapClick={handleMapClick}
          onWaypointClick={handleWaypointSelect}
          selectedWaypointId={selectedWaypointId}
        />
      </div>

      {/* Editor Panel — 35% */}
      <div className="flex-[35] flex flex-col border-l border-border-default bg-bg-secondary min-w-[300px] max-w-[420px]">
        <div className="px-3 py-2 border-b border-border-default">
          <h2 className="text-sm font-display font-semibold text-text-primary">Mission Planner</h2>
        </div>

        <Tabs tabs={PANEL_TABS} activeTab={activeTab} onChange={setActiveTab} />

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "mission" && (
            <MissionEditor
              drones={drones}
              waypoints={waypoints}
              onCreateMission={handleCreateMission}
              onClear={handleClear}
              onDispatch={handleDispatchOpen}
            />
          )}

          {activeTab === "waypoints" && (
            <WaypointList
              waypoints={waypoints}
              selectedId={selectedWaypointId}
              onSelect={handleWaypointSelect}
              onRemove={removeWaypoint}
            />
          )}

          {activeTab === "geofence" && (
            <div className="p-3">
              <GeofenceEditor
                enabled={geofenceEnabled}
                onToggle={setGeofenceEnabled}
                type={geofenceType}
                onTypeChange={setGeofenceType}
                maxAlt={geofenceMaxAlt}
                onMaxAltChange={setGeofenceMaxAlt}
                action={geofenceAction}
                onActionChange={setGeofenceAction}
              />
            </div>
          )}
        </div>
      </div>

      {/* Waypoint Editor Modal */}
      <WaypointEditorModal
        open={!!editingWaypoint}
        onClose={() => setEditingWaypoint(null)}
        waypoint={editingWaypoint}
        onSave={handleWaypointSave}
      />

      {/* Dispatch Confirm Dialog */}
      <DispatchConfirmDialog
        open={showDispatch}
        onConfirm={handleDispatchConfirm}
        onCancel={() => setShowDispatch(false)}
        missionName={pendingMissionName}
        drone={selectedDrone}
        waypoints={waypoints}
      />
    </div>
  );
}
