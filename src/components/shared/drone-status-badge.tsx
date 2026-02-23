"use client";

import { Badge } from "@/components/ui/badge";
import type { DroneStatus } from "@/lib/types";

interface DroneStatusBadgeProps {
  status: DroneStatus;
}

const variants: Record<DroneStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  online: "success",
  in_mission: "info",
  idle: "neutral",
  returning: "warning",
  maintenance: "error",
  offline: "neutral",
};

const labels: Record<DroneStatus, string> = {
  online: "Online",
  in_mission: "In Mission",
  idle: "Idle",
  returning: "Returning",
  maintenance: "Maintenance",
  offline: "Offline",
};

export function DroneStatusBadge({ status }: DroneStatusBadgeProps) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
