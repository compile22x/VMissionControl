"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DataValue } from "@/components/ui/data-value";
import { Card } from "@/components/ui/card";
import type { FleetDrone, SuiteType, Waypoint } from "@/lib/types";
import { haversineDistance } from "@/lib/telemetry-utils";

const MISSION_TYPE_OPTIONS = [
  { value: "survey", label: "Survey" },
  { value: "patrol", label: "Patrol" },
  { value: "delivery", label: "Delivery" },
  { value: "custom", label: "Custom" },
];

const SUITE_OPTIONS: { value: SuiteType | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "sentry", label: "Sentry" },
  { value: "survey", label: "Survey" },
  { value: "agriculture", label: "Agriculture" },
  { value: "cargo", label: "Cargo" },
  { value: "sar", label: "SAR" },
  { value: "inspection", label: "Inspection" },
];

function calculateTotalDistance(waypoints: Waypoint[]): number {
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += haversineDistance(
      waypoints[i - 1].lat,
      waypoints[i - 1].lon,
      waypoints[i].lat,
      waypoints[i].lon
    );
  }
  return total;
}

interface MissionEditorProps {
  drones: FleetDrone[];
  waypoints: Waypoint[];
  onCreateMission: (name: string, droneId: string, suiteType?: SuiteType) => void;
  onClear: () => void;
  onDispatch: () => void;
}

export function MissionEditor({
  drones,
  waypoints,
  onCreateMission,
  onClear,
  onDispatch,
}: MissionEditorProps) {
  const [missionName, setMissionName] = useState("");
  const [missionType, setMissionType] = useState("survey");
  const [selectedDroneId, setSelectedDroneId] = useState("");
  const [suiteType, setSuiteType] = useState("");

  const availableDrones = drones.filter(
    (d) => d.status === "idle" || d.status === "online"
  );

  const droneOptions = [
    { value: "", label: "Select drone..." },
    ...availableDrones.map((d) => ({
      value: d.id,
      label: `${d.name} (${Math.round(d.battery?.remaining ?? 0)}%)`,
    })),
  ];

  const totalDistance = calculateTotalDistance(waypoints);
  const distanceKm = (totalDistance / 1000).toFixed(2);

  const handleCreate = () => {
    if (!missionName.trim() || !selectedDroneId) return;
    onCreateMission(
      missionName.trim(),
      selectedDroneId,
      suiteType ? (suiteType as SuiteType) : undefined
    );
  };

  const canCreate = missionName.trim() && selectedDroneId;
  const canDispatch = waypoints.length >= 2;

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <Card title="Mission Setup" padding={true}>
        <div className="flex flex-col gap-3">
          <Input
            label="Mission Name"
            placeholder="e.g., Campus Patrol A"
            value={missionName}
            onChange={(e) => setMissionName(e.target.value)}
          />
          <Select
            label="Mission Type"
            options={MISSION_TYPE_OPTIONS}
            value={missionType}
            onChange={setMissionType}
          />
          <Select
            label="Assign Drone"
            options={droneOptions}
            value={selectedDroneId}
            onChange={setSelectedDroneId}
          />
          <Select
            label="Suite"
            options={SUITE_OPTIONS}
            value={suiteType}
            onChange={setSuiteType}
          />
        </div>
      </Card>

      <Card title="Mission Stats" padding={true}>
        <div className="grid grid-cols-2 gap-3">
          <DataValue label="Waypoints" value={waypoints.length} />
          <DataValue label="Distance" value={distanceKm} unit="km" />
        </div>
      </Card>

      <div className="flex flex-col gap-2 mt-auto pt-3">
        {!canCreate ? null : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!canDispatch}
            onClick={() => {
              handleCreate();
              onDispatch();
            }}
          >
            Dispatch Mission
          </Button>
        )}
        {!canCreate && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!canCreate}
            onClick={handleCreate}
          >
            Create Mission
          </Button>
        )}
        <Button variant="ghost" size="md" className="w-full" onClick={onClear}>
          Clear All
        </Button>
      </div>
    </div>
  );
}
