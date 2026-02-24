/**
 * @module MissionEditor
 * @description Mission setup form in the right panel — mission name input,
 * drone assignment dropdown, and suite type selector.
 * @license GPL-3.0-only
 */
"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FleetDrone, SuiteType } from "@/lib/types";

const SUITE_OPTIONS: { value: SuiteType | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "sentry", label: "Sentry" },
  { value: "survey", label: "Survey" },
  { value: "agriculture", label: "Agriculture" },
  { value: "cargo", label: "Cargo" },
  { value: "sar", label: "SAR" },
  { value: "inspection", label: "Inspection" },
];

interface MissionEditorProps {
  drones: FleetDrone[];
  missionName: string;
  selectedDroneId: string;
  suiteType: string;
  onNameChange: (name: string) => void;
  onDroneChange: (droneId: string) => void;
  onSuiteChange: (suite: string) => void;
}

export function MissionEditor({
  drones,
  missionName,
  selectedDroneId,
  suiteType,
  onNameChange,
  onDroneChange,
  onSuiteChange,
}: MissionEditorProps) {
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

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <Input
        label="Mission Name"
        placeholder="e.g., Campus Patrol A"
        value={missionName}
        onChange={(e) => onNameChange(e.target.value)}
      />
      <Select
        label="Assign Drone"
        options={droneOptions}
        value={selectedDroneId}
        onChange={onDroneChange}
      />
      <Select
        label="Suite"
        options={SUITE_OPTIONS}
        value={suiteType}
        onChange={onSuiteChange}
      />
    </div>
  );
}
