"use client";

import { cn } from "@/lib/utils";
import type { ItemStatus } from "@/lib/community-types";

const statusConfig: Record<ItemStatus, { label: string; className: string }> = {
  backlog: { label: "Backlog", className: "text-text-tertiary bg-text-tertiary/10" },
  in_discussion: { label: "In Discussion", className: "text-accent-primary bg-accent-primary/10" },
  planned: { label: "Planned", className: "text-status-warning bg-status-warning/10" },
  in_progress: { label: "In Progress", className: "text-accent-primary bg-accent-primary/10" },
  released: { label: "Released", className: "text-status-success bg-status-success/10" },
  wont_do: { label: "Won't Do", className: "text-text-tertiary bg-text-tertiary/10" },
};

interface StatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
