"use client";

import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "ALL" },
];

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-0">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-mono font-semibold border border-border-default transition-colors cursor-pointer",
            "-ml-px first:ml-0",
            value === p.value
              ? "bg-accent-primary text-white border-accent-primary z-10"
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
