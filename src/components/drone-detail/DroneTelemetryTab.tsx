"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card } from "@/components/ui/card";
import { ChartWrapper, CHART_COLORS, CHART_DEFAULTS } from "@/components/shared/chart-wrapper";
import type { FleetDrone } from "@/lib/types";

interface DroneTelemetryTabProps {
  drone: FleetDrone;
}

export function DroneTelemetryTab({ drone }: DroneTelemetryTabProps) {
  // Generate mock altitude history data
  const altitudeData = useMemo(() => {
    const data = [];
    const now = Date.now();
    const baseAlt = drone.position?.alt ?? 50;
    for (let i = 59; i >= 0; i--) {
      data.push({
        time: new Date(now - i * 1000).toLocaleTimeString("en-IN", {
          minute: "2-digit",
          second: "2-digit",
        }),
        altitude: Math.max(0, baseAlt + Math.sin(i * 0.2) * 10 + (Math.random() - 0.5) * 5),
      });
    }
    return data;
  }, [drone.position?.alt]);

  // Generate mock battery discharge data
  const batteryData = useMemo(() => {
    const data = [];
    const startPct = Math.min(100, (drone.battery?.remaining ?? 80) + 15);
    const endPct = drone.battery?.remaining ?? 80;
    for (let i = 0; i < 30; i++) {
      const t = i / 29;
      const pct = startPct - (startPct - endPct) * t + (Math.random() - 0.5) * 2;
      data.push({
        time: `${i}m`,
        battery: Math.max(0, Math.min(100, pct)),
        voltage: (22.2 * Math.max(0, Math.min(100, pct))) / 100,
      });
    }
    return data;
  }, [drone.battery?.remaining]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
      <Card title="Altitude History">
        <ChartWrapper height={240}>
          <LineChart data={altitudeData}>
            <CartesianGrid {...CHART_DEFAULTS.gridStyle} />
            <XAxis
              dataKey="time"
              {...CHART_DEFAULTS.axisStyle}
              interval={9}
            />
            <YAxis
              {...CHART_DEFAULTS.axisStyle}
              domain={["auto", "auto"]}
              unit="m"
            />
            <Tooltip {...CHART_DEFAULTS.tooltipStyle} />
            <Line
              type="monotone"
              dataKey="altitude"
              stroke={CHART_COLORS.primary}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartWrapper>
      </Card>

      <Card title="Battery Discharge">
        <ChartWrapper height={240}>
          <LineChart data={batteryData}>
            <CartesianGrid {...CHART_DEFAULTS.gridStyle} />
            <XAxis
              dataKey="time"
              {...CHART_DEFAULTS.axisStyle}
              interval={4}
            />
            <YAxis
              {...CHART_DEFAULTS.axisStyle}
              domain={[0, 100]}
              unit="%"
            />
            <Tooltip {...CHART_DEFAULTS.tooltipStyle} />
            <Line
              type="monotone"
              dataKey="battery"
              stroke={CHART_COLORS.success}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartWrapper>
      </Card>

      <Card title="Voltage Over Time" className="md:col-span-2">
        <ChartWrapper height={200}>
          <LineChart data={batteryData}>
            <CartesianGrid {...CHART_DEFAULTS.gridStyle} />
            <XAxis
              dataKey="time"
              {...CHART_DEFAULTS.axisStyle}
              interval={4}
            />
            <YAxis
              {...CHART_DEFAULTS.axisStyle}
              domain={["auto", "auto"]}
              unit="V"
            />
            <Tooltip {...CHART_DEFAULTS.tooltipStyle} />
            <Line
              type="monotone"
              dataKey="voltage"
              stroke={CHART_COLORS.warning}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartWrapper>
      </Card>
    </div>
  );
}
