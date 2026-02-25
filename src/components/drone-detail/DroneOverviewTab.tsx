"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { TelemetryReadout } from "@/components/flight/TelemetryReadout";
import { CompactInfoCards } from "@/components/flight/CompactInfoCards";
import { FlightControlsBar } from "@/components/flight/FlightControlsBar";
import { OsdOverlay } from "@/components/flight/OsdOverlay";
import { VideoCanvas } from "@/components/flight/VideoCanvas";
import type { FleetDrone } from "@/lib/types";

const OverviewHud = dynamic(
  () => import("@/components/flight/OverviewHud").then((m) => m.OverviewHud),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0a1428] border border-border-default flex items-center justify-center">
        <span className="text-[10px] font-mono text-text-tertiary">Loading HUD...</span>
      </div>
    ),
  }
);

const OverviewMap = dynamic(
  () => import("@/components/flight/OverviewMap").then((m) => m.OverviewMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0a0a0a] border border-border-default flex items-center justify-center">
        <span className="text-[10px] font-mono text-text-tertiary">Loading Map...</span>
      </div>
    ),
  }
);

interface DroneOverviewTabProps {
  drone: FleetDrone;
}

type RightPanel = "map" | "fly";

export function DroneOverviewTab({ drone }: DroneOverviewTabProps) {
  const [rightPanel, setRightPanel] = useState<RightPanel>("map");

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left column: HUD + Telemetry + Info */}
      <div className="w-80 shrink-0 flex flex-col overflow-y-auto border-r border-border-default">
        {/* Compact HUD */}
        <div className="h-60 shrink-0">
          <OverviewHud />
        </div>

        {/* Telemetry readout */}
        <TelemetryReadout />

        {/* Drone info cards */}
        <CompactInfoCards drone={drone} />
      </div>

      {/* Right column: Map / Fly toggle */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Sub-tab bar */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-bg-secondary border-b border-border-default shrink-0">
          <button
            onClick={() => setRightPanel("map")}
            className={
              rightPanel === "map"
                ? "px-3 py-1 text-xs font-mono font-semibold text-text-primary bg-bg-tertiary rounded"
                : "px-3 py-1 text-xs font-mono text-text-tertiary hover:text-text-secondary transition-colors rounded"
            }
          >
            Map
          </button>
          <button
            onClick={() => setRightPanel("fly")}
            className={
              rightPanel === "fly"
                ? "px-3 py-1 text-xs font-mono font-semibold text-text-primary bg-bg-tertiary rounded"
                : "px-3 py-1 text-xs font-mono text-text-tertiary hover:text-text-secondary transition-colors rounded"
            }
          >
            Fly
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 min-h-0">
          {rightPanel === "map" && <OverviewMap />}
          {rightPanel === "fly" && (
            <div className="flex flex-col h-full">
              <div className="flex-1 relative min-h-0">
                <VideoCanvas>
                  <OsdOverlay />
                </VideoCanvas>
              </div>
              <FlightControlsBar />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
