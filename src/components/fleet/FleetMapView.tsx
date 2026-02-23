"use client";

import { FleetMap } from "@/components/shared/fleet-map";
import type { FleetDrone } from "@/lib/types";

interface FleetMapViewProps {
  drones: FleetDrone[];
  onDroneClick: (id: string) => void;
}

export function FleetMapView({ drones, onDroneClick }: FleetMapViewProps) {
  return (
    <div className="flex-1 min-h-[400px]">
      <FleetMap
        drones={drones}
        onDroneClick={onDroneClick}
        className="w-full h-full"
      />
    </div>
  );
}
