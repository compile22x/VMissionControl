"use client";

import type { WidgetProps } from "./types";
import { cn } from "@/lib/utils";

interface StatusItem {
  label: string;
  active: boolean;
  color: "green" | "amber" | "red" | "blue";
}

const colorMap: Record<string, string> = {
  green: "bg-status-success",
  amber: "bg-status-warning",
  red: "bg-status-error",
  blue: "bg-accent-primary",
};

function getStatuses(suiteType?: string): StatusItem[] {
  switch (suiteType) {
    case "sentry":
      return [
        { label: "Armed", active: true, color: "green" },
        { label: "Recording", active: true, color: "red" },
        { label: "Motion Detection", active: true, color: "blue" },
        { label: "Alerts Active", active: true, color: "amber" },
      ];
    case "survey":
      return [
        { label: "Camera Active", active: true, color: "green" },
        { label: "Recording", active: true, color: "red" },
        { label: "Geotagging", active: true, color: "blue" },
        { label: "Auto Shutter", active: true, color: "green" },
      ];
    case "sar":
      return [
        { label: "Thermal Camera", active: true, color: "green" },
        { label: "Recording", active: true, color: "red" },
        { label: "AI Detection", active: true, color: "blue" },
        { label: "Beacon Listening", active: false, color: "amber" },
      ];
    default:
      return [
        { label: "Connected", active: true, color: "green" },
        { label: "Recording", active: false, color: "red" },
        { label: "Tracking", active: true, color: "blue" },
      ];
  }
}

export function SuiteStatusWidget({ suiteType, className }: WidgetProps) {
  const statuses = getStatuses(suiteType);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {statuses.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 shrink-0",
              item.active
                ? colorMap[item.color]
                : "bg-text-tertiary"
            )}
          />
          <span
            className={cn(
              "text-xs",
              item.active ? "text-text-primary" : "text-text-tertiary"
            )}
          >
            {item.label}
          </span>
          <span
            className={cn(
              "text-[10px] font-mono ml-auto",
              item.active ? "text-text-secondary" : "text-text-tertiary"
            )}
          >
            {item.active ? "ON" : "OFF"}
          </span>
        </div>
      ))}
    </div>
  );
}
