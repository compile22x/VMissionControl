"use client";

import type { WidgetProps } from "./types";
import { DataValue } from "@/components/ui/data-value";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: string | number;
  unit?: string;
}

function getStats(suiteType?: string): StatItem[] {
  switch (suiteType) {
    case "sentry":
      return [
        { label: "Patrol Laps", value: 3 },
        { label: "Area Covered", value: "1.2", unit: "km\u00B2" },
        { label: "Detections", value: 2 },
        { label: "Alerts Sent", value: 1 },
      ];
    case "survey":
      return [
        { label: "Images Captured", value: 142 },
        { label: "Overlap", value: 78, unit: "%" },
        { label: "GSD", value: "2.1", unit: "cm/px" },
        { label: "Coverage", value: "0.8", unit: "km\u00B2" },
      ];
    case "sar":
      return [
        { label: "Search Area", value: "2.4", unit: "km\u00B2" },
        { label: "Grid Cells", value: "6/10" },
        { label: "Thermal Hits", value: 3 },
        { label: "Persons Found", value: 0 },
      ];
    case "agriculture":
      return [
        { label: "Spray Volume", value: "4.2", unit: "L" },
        { label: "Area Sprayed", value: "0.6", unit: "ha" },
        { label: "Flow Rate", value: "1.2", unit: "L/min" },
        { label: "Nozzle Status", value: "OK" },
      ];
    default:
      return [
        { label: "Waypoints", value: "5/10" },
        { label: "Distance", value: "2.1", unit: "km" },
        { label: "Time Elapsed", value: "12:30" },
        { label: "ETA", value: "08:15" },
      ];
  }
}

export function SuiteStatsWidget({ suiteType, className }: WidgetProps) {
  const stats = getStats(suiteType);

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {stats.map((stat) => (
        <DataValue
          key={stat.label}
          label={stat.label}
          value={stat.value}
          unit={stat.unit}
        />
      ))}
    </div>
  );
}
