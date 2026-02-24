/**
 * @module CollapsibleSection
 * @description Reusable collapsible section with chevron toggle, optional item count badge,
 * and trailing action slot. Used throughout the planner right panel.
 * @license GPL-3.0-only
 */
"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  count?: number;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  count,
  trailing,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border-b border-border-default", className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(!open); } }}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-tertiary transition-colors cursor-pointer"
      >
        {open ? (
          <ChevronDown size={12} className="text-text-tertiary shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-text-tertiary shrink-0" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex-1 text-left">
          {title}
        </span>
        {count !== undefined && (
          <span className="text-[10px] font-mono text-text-tertiary">({count})</span>
        )}
        {trailing && (
          <div onClick={(e) => e.stopPropagation()}>{trailing}</div>
        )}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}
