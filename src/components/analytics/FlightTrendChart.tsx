"use client";

import { Card } from "@/components/ui/card";
import { ChartWrapper, CHART_COLORS, CHART_DEFAULTS } from "@/components/shared/chart-wrapper";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";

interface FlightTrendChartProps {
  data: { date: string; count: number }[];
}

export function FlightTrendChart({ data }: FlightTrendChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    count: d.count,
  }));

  return (
    <Card title="Flights Per Day" padding={true}>
      <ChartWrapper height={220}>
        <AreaChart data={chartData}>
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
            allowDecimals={false}
          />
          <RechartsTooltip {...CHART_DEFAULTS.tooltipStyle} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartWrapper>
    </Card>
  );
}
