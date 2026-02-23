"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataValue } from "@/components/ui/data-value";
import type { Waypoint, FleetDrone } from "@/lib/types";
import { haversineDistance } from "@/lib/telemetry-utils";

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

interface DispatchConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  missionName: string;
  drone: FleetDrone | null;
  waypoints: Waypoint[];
}

export function DispatchConfirmDialog({
  open,
  onConfirm,
  onCancel,
  missionName,
  drone,
  waypoints,
}: DispatchConfirmDialogProps) {
  const totalDistance = calculateTotalDistance(waypoints);
  const distanceKm = (totalDistance / 1000).toFixed(2);
  // Rough estimate: assume 8 m/s average speed
  const estimatedTimeSec = totalDistance / 8;
  const estimatedMin = Math.ceil(estimatedTimeSec / 60);
  const batteryLevel = drone?.battery?.remaining ?? 100;
  const lowBattery = batteryLevel < 50;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Confirm Mission Dispatch"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            Dispatch
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-secondary">Mission</span>
          <span className="text-sm font-semibold text-text-primary">{missionName || "Unnamed"}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-text-secondary">Drone</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-text-primary">{drone?.name ?? "---"}</span>
            {drone && (
              <Badge variant={lowBattery ? "warning" : "success"} size="sm">
                {Math.round(batteryLevel)}%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DataValue label="Waypoints" value={waypoints.length} />
          <DataValue label="Distance" value={distanceKm} unit="km" />
          <DataValue label="Est. Time" value={estimatedMin} unit="min" />
        </div>

        {lowBattery && (
          <div className="bg-status-warning/10 border border-status-warning/30 px-3 py-2">
            <span className="text-xs text-status-warning">
              Warning: Drone battery is below 50%. Mission may not complete.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
