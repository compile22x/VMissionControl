"use client";

import type { WidgetProps } from "./types";
import { cn } from "@/lib/utils";

interface LogEntry {
  time: string;
  type: string;
  details: string;
  [key: string]: unknown;
}

const SENTRY_LOG: LogEntry[] = [
  { time: "12:04:12", type: "Motion", details: "Zone A — perimeter breach" },
  { time: "12:02:45", type: "Vehicle", details: "Unregistered vehicle spotted" },
  { time: "11:58:30", type: "Clear", details: "Zone B patrol complete" },
];

const SAR_LOG: LogEntry[] = [
  { time: "12:06:01", type: "Thermal", details: "Heat signature — Grid C4" },
  { time: "12:03:18", type: "Thermal", details: "Animal detected — Grid B2" },
  { time: "11:59:44", type: "Visual", details: "Debris field — Grid A3" },
];

const DEFAULT_LOG: LogEntry[] = [
  { time: "12:05:00", type: "Info", details: "Waypoint 3 reached" },
  { time: "12:02:30", type: "Info", details: "Waypoint 2 reached" },
  { time: "12:00:00", type: "Start", details: "Mission started" },
];

function getLog(suiteType?: string): LogEntry[] {
  switch (suiteType) {
    case "sentry":
      return SENTRY_LOG;
    case "sar":
      return SAR_LOG;
    default:
      return DEFAULT_LOG;
  }
}

export function SuiteTableWidget({ suiteType, className }: WidgetProps) {
  const log = getLog(suiteType);

  return (
    <div
      className={cn(
        "border border-border-default overflow-hidden",
        className
      )}
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-default bg-bg-tertiary">
            <th className="px-2 py-1.5 text-left font-semibold text-text-secondary uppercase tracking-wider">
              Time
            </th>
            <th className="px-2 py-1.5 text-left font-semibold text-text-secondary uppercase tracking-wider">
              Type
            </th>
            <th className="px-2 py-1.5 text-left font-semibold text-text-secondary uppercase tracking-wider">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {log.map((entry, i) => (
            <tr
              key={i}
              className="border-b border-border-default last:border-b-0"
            >
              <td className="px-2 py-1.5 font-mono text-text-tertiary tabular-nums">
                {entry.time}
              </td>
              <td className="px-2 py-1.5 text-text-primary font-semibold">
                {entry.type}
              </td>
              <td className="px-2 py-1.5 text-text-secondary">
                {entry.details}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
