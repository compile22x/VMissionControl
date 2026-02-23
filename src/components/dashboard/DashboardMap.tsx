"use client";

import { useRouter } from "next/navigation";
import { useFleetStore } from "@/stores/fleet-store";
import { FleetMap } from "@/components/shared/fleet-map";

export function DashboardMap() {
  const router = useRouter();
  const drones = useFleetStore((s) => s.drones);

  const handleDroneClick = (id: string) => {
    router.push(`/fly/${id}`);
  };

  return (
    <FleetMap
      drones={drones}
      onDroneClick={handleDroneClick}
      className="w-full h-full min-h-[300px]"
    />
  );
}
