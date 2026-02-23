"use client";

import { DroneCard } from "@/components/shared/drone-card";
import type { FleetDrone } from "@/lib/types";

interface FleetGridProps {
  drones: FleetDrone[];
  onDroneClick: (id: string) => void;
}

export function FleetGrid({ drones, onDroneClick }: FleetGridProps) {
  if (drones.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-text-tertiary">
        No drones match the current filters
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
      {drones.map((drone) => (
        <DroneCard key={drone.id} drone={drone} onClick={onDroneClick} />
      ))}
    </div>
  );
}
