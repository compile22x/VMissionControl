"use client";

import React, { useEffect } from "react";
import { useDroneStore } from "@/stores/drone-store";
import { useMissionStore } from "@/stores/mission-store";
import { useFleetStore } from "@/stores/fleet-store";
import { VideoCanvas } from "@/components/flight/VideoCanvas";
import { OsdOverlay } from "@/components/flight/OsdOverlay";
import { TelemetryPanel } from "@/components/flight/TelemetryPanel";
import { FlightControlsBar } from "@/components/flight/FlightControlsBar";
import { SuiteDashboard } from "@/components/flight/SuiteDashboard";
import { getMockMission } from "@/mock/missions";

export default function FlightViewPage({
  params,
}: {
  params: Promise<{ droneId: string }>;
}) {
  const { droneId } = React.use(params);
  const selectDrone = useDroneStore((s) => s.selectDrone);
  const setFlightMode = useDroneStore((s) => s.setFlightMode);
  const setArmState = useDroneStore((s) => s.setArmState);
  const setMission = useMissionStore((s) => s.setMission);
  const drones = useFleetStore((s) => s.drones);

  const drone = drones.find((d) => d.id === droneId);

  useEffect(() => {
    selectDrone(droneId);

    // Load mock mission if available
    const mission = getMockMission(droneId);
    if (mission) {
      setMission(mission);
    }

    // Sync flight mode and arm state from fleet drone
    if (drone) {
      setFlightMode(drone.flightMode);
      setArmState(drone.armState);
    }

    return () => {
      selectDrone(null);
      setMission(null);
    };
  }, [droneId, drone, selectDrone, setMission, setFlightMode, setArmState]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Main area: Video + Telemetry sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video canvas area */}
        <div className="flex-1 relative">
          <VideoCanvas>
            <OsdOverlay />
          </VideoCanvas>

          {/* Drone name overlay — top center */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="px-2 py-0.5 text-xs font-mono font-semibold text-gcs-hud-green bg-black/60">
              {drone?.name ?? droneId}
            </span>
          </div>
        </div>

        {/* Right sidebar: Telemetry + Suite dashboard */}
        <div className="flex flex-col">
          <TelemetryPanel />
          <SuiteDashboard />
        </div>
      </div>

      {/* Bottom controls bar */}
      <FlightControlsBar />
    </div>
  );
}
