"use client";

import { cn } from "@/lib/utils";

interface StatusDotProps {
  status: "online" | "idle" | "warning" | "error" | "offline";
  className?: string;
}

const statusColors: Record<string, string> = {
  online: "bg-status-success",
  idle: "bg-accent-primary",
  warning: "bg-status-warning",
  error: "bg-status-error",
  offline: "bg-text-tertiary",
};

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full", statusColors[status], className)}
      title={status}
    />
  );
}
