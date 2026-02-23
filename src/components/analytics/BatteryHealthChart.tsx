"use client";

import { Card } from "@/components/ui/card";
import { ChartWrapper, CHART_COLORS, CHART_DEFAULTS } from "@/components/shared/chart-wrapper";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

interface BatteryHealthChartProps {
  data: { date: string; avgCapacity: number }[];
}

export function BatteryHealthChart({ data }: BatteryHealthChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    capacity: parseFloat(d.avgCapacity.toFixed(1)),
  }));

  return (
    <Card title="Battery Capacity Trend" padding={true}>
      <ChartWrapper height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" {...CHART_DEFAULTS.gridStyle} />
          <XAxis
            dataKey="date"
            tick={CHART_DEFAULTS.axisStyle}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={CHART_DEFAULTS.axisStyle}
            tickLine={false}
            axisLine={false}
            domain={[90, 101]}
          />
          <RechartsTooltip {...CHART_DEFAULTS.tooltipStyle} />
          <Line
            type="monotone"
            dataKey="capacity"
            stroke={CHART_COLORS.warning}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartWrapper>
    </Card>
  );
}
