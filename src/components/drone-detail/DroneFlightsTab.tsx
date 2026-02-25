"use client";

import { useMemo } from "react";
import { Table, type Column } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getFlightHistory } from "@/mock/history";
import { formatDate, formatDuration } from "@/lib/utils";
import type { FlightRecord } from "@/lib/types";

interface DroneFlightsTabProps {
  droneId: string;
}

type FlightRecordRow = FlightRecord & Record<string, unknown>;

const statusVariant: Record<string, "success" | "warning" | "error"> = {
  completed: "success",
  aborted: "warning",
  emergency: "error",
};

const columns: Column<FlightRecordRow>[] = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    width: "18%",
    render: (row) => (
      <span className="font-mono text-text-primary tabular-nums">
        {formatDate(row.date)}
      </span>
    ),
  },
  {
    key: "duration",
    label: "Duration",
    sortable: true,
    width: "14%",
    render: (row) => (
      <span className="font-mono text-text-primary tabular-nums">
        {formatDuration(row.duration)}
      </span>
    ),
  },
  {
    key: "distance",
    label: "Distance",
    sortable: true,
    width: "14%",
    render: (row) => (
      <span className="font-mono text-text-primary tabular-nums">
        {(row.distance / 1000).toFixed(1)} km
      </span>
    ),
  },
  {
    key: "maxAlt",
    label: "Max Alt",
    sortable: true,
    width: "12%",
    render: (row) => (
      <span className="font-mono text-text-primary tabular-nums">
        {row.maxAlt}m
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    width: "14%",
    render: (row) => (
      <Badge variant={statusVariant[row.status] || "neutral"}>
        {row.status}
      </Badge>
    ),
  },
  {
    key: "batteryUsed",
    label: "Battery Used",
    sortable: true,
    width: "14%",
    render: (row) => (
      <span className="font-mono text-text-primary tabular-nums">
        {row.batteryUsed}%
      </span>
    ),
  },
  {
    key: "suiteType",
    label: "Suite",
    width: "14%",
    render: (row) => (
      <span className="text-text-secondary capitalize">
        {row.suiteType ?? "---"}
      </span>
    ),
  },
];

export function DroneFlightsTab({ droneId }: DroneFlightsTabProps) {
  const flights = useMemo(() => {
    const all = getFlightHistory();
    return all.filter((f) => f.droneId === droneId);
  }, [droneId]);

  if (flights.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-text-tertiary">
        No flight records found for this drone
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-3">
      <div className="text-xs text-text-secondary mb-2">
        {flights.length} flight{flights.length !== 1 ? "s" : ""} recorded
      </div>
      <Table
        columns={columns}
        data={flights as FlightRecordRow[]}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
