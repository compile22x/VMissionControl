"use client";

import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { AnalyticsData, FlightRecord } from "@/lib/types";

interface DronePerformanceGridProps {
  analytics: AnalyticsData;
  flights: FlightRecord[];
}

interface DroneStats {
  droneName: string;
  droneId: string;
  totalHours: number;
  missionCount: number;
  healthScore: number;
}

export function DronePerformanceGrid({ analytics, flights }: DronePerformanceGridProps) {
  // Build per-drone stats
  const droneMap = new Map<string, DroneStats>();

  for (const f of flights) {
    const existing = droneMap.get(f.droneId);
    if (existing) {
      existing.totalHours += f.duration / 3600;
      existing.missionCount += 1;
    } else {
      droneMap.set(f.droneId, {
        droneId: f.droneId,
        droneName: f.droneName,
        totalHours: f.duration / 3600,
        missionCount: 1,
        healthScore: 70 + Math.random() * 25,
      });
    }
  }

  const droneStats = Array.from(droneMap.values());

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {droneStats.map((drone) => (
        <Card key={drone.droneId} padding={true}>
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
              {drone.droneName}
            </h4>

            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-text-tertiary">Health Score</span>
              <ProgressBar
                value={drone.healthScore}
                showLabel={true}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DataValue
                label="Flight Hours"
                value={drone.totalHours.toFixed(1)}
                unit="hrs"
              />
              <DataValue
                label="Missions"
                value={drone.missionCount}
              />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
