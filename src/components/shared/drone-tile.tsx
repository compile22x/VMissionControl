"use client";

import { cn } from "@/lib/utils";
import { useDroneMetadataStore } from "@/stores/drone-metadata-store";
import type { FleetDrone, DroneStatus } from "@/lib/types";

interface DroneTileProps {
  drone: FleetDrone;
  selected?: boolean;
  onClick?: (id: string) => void;
}

const statusDotColor: Record<DroneStatus, string> = {
  online: "bg-status-success",
  in_mission: "bg-status-success",
  idle: "bg-accent-primary",
  returning: "bg-status-warning",
  maintenance: "bg-status-error",
  offline: "bg-text-tertiary",
};

const batteryColor = (pct: number) =>
  pct > 50 ? "bg-status-success" : pct > 25 ? "bg-status-warning" : "bg-status-error";

export function DroneTile({ drone, selected, onClick }: DroneTileProps) {
  const displayName =
    useDroneMetadataStore((s) => s.profiles[drone.id]?.displayName) ?? drone.name;
  const initials = displayName.slice(0, 2).toUpperCase();
  const batteryPct = Math.max(0, Math.min(100, drone.battery?.remaining ?? 0));
  const isArmed = drone.armState === "armed";

  return (
    <button
      onClick={() => onClick?.(drone.id)}
      title={`${displayName} — ${drone.status.replace("_", " ")} — ${batteryPct}%`}
      className={cn(
        "relative w-9 h-9 shrink-0 flex items-center justify-center border transition-colors cursor-pointer",
        "bg-bg-primary border-border-default hover:border-border-strong",
        selected && "border-accent-primary bg-accent-primary/10",
        isArmed && "ring-1 ring-status-warning/50",
      )}
    >
      {/* Status dot — top right */}
      <span
        className={cn(
          "absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full",
          statusDotColor[drone.status],
        )}
      />

      {/* Initials */}
      <span className="text-[9px] font-mono font-bold text-text-secondary">
        {initials}
      </span>

      {/* Battery bar — bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-bg-tertiary">
        <div
          className={cn("h-full", batteryColor(batteryPct))}
          style={{ width: `${batteryPct}%` }}
        />
      </div>
    </button>
  );
}
