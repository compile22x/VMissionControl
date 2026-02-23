"use client";

import { ResponsiveContainer } from "recharts";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartWrapperProps {
  height?: number;
  children: ReactNode;
  className?: string;
}

export function ChartWrapper({ height = 200, children, className }: ChartWrapperProps) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export const CHART_COLORS = {
  primary: "#3a82ff",
  secondary: "#dff140",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  grid: "#1a1a1a",
  text: "#666666",
  bg: "#0a0a0a",
};

export const CHART_DEFAULTS = {
  axisStyle: {
    fontSize: 10,
    fontFamily: "JetBrains Mono, monospace",
    fill: "#666666",
  },
  gridStyle: {
    stroke: "#1a1a1a",
  },
  tooltipStyle: {
    contentStyle: {
      backgroundColor: "#0a0a0a",
      border: "1px solid #1a1a1a",
      fontSize: 11,
      fontFamily: "JetBrains Mono, monospace",
      color: "#fafafa",
    },
  },
};
