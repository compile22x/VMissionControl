"use client";

import { Card } from "@/components/ui/card";
import { ChartWrapper, CHART_COLORS, CHART_DEFAULTS } from "@/components/shared/chart-wrapper";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

interface UtilizationChartProps {
  data: { droneId: string; droneName: string; hours: number }[];
}

export function UtilizationChart({ data }: UtilizationChartProps) {
  const chartData = data.map((d) => ({
    name: d.droneName,
    hours: parseFloat(d.hours.toFixed(1)),
  }));

  return (
    <Card title="Hours Per Drone" padding={true}>
      <ChartWrapper height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" {...CHART_DEFAULTS.gridStyle} />
          <XAxis
            dataKey="name"
            tick={CHART_DEFAULTS.axisStyle}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={CHART_DEFAULTS.axisStyle}
            tickLine={false}
            axisLine={false}
          />
          <RechartsTooltip {...CHART_DEFAULTS.tooltipStyle} />
          <Bar
            dataKey="hours"
            fill={CHART_COLORS.primary}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartWrapper>
    </Card>
  );
}
