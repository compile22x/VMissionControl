"use client";

import { cn } from "@/lib/utils";
import type { ItemCategory } from "@/lib/community-types";

const categoryConfig: Record<ItemCategory, { label: string; className: string }> = {
  command: { label: "Command", className: "text-accent-primary border-accent-primary/30" },
  ados: { label: "ADOS", className: "text-accent-secondary border-accent-secondary/30" },
  website: { label: "Website", className: "text-status-warning border-status-warning/30" },
  general: { label: "General", className: "text-text-secondary border-text-tertiary/30" },
};

interface CategoryBadgeProps {
  category: ItemCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const config = categoryConfig[category];
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
