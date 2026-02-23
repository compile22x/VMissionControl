"use client";

import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SparklineChart } from "@/components/shared/sparkline-chart";
import { CHART_COLORS } from "@/components/shared/chart-wrapper";
import type { AnalyticsData } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface AnalyticsStatCardsProps {
  data: AnalyticsData;
}

export function AnalyticsStatCards({ data }: AnalyticsStatCardsProps) {
  const totalHours = (data.totalFlightTime / 3600).toFixed(1);
  const avgDuration = formatDuration(Math.round(data.avgFlightTime));
  const successRate = data.missionSuccessRate.toFixed(1);

  // Sparkline data from flightsPerDay
  const flightCounts = data.flightsPerDay.map((d) => d.count);

  // Mini breakdown for total missions
  const completedCount = Math.round(
    (data.missionSuccessRate / 100) * data.totalFlights
  );
  const failedCount = data.totalFlights - completedCount;

  return (
    <div className="grid grid-cols-4 gap-3">
      {/* Total Flight Hours */}
      <Card padding={true}>
        <div className="flex items-start justify-between">
          <DataValue label="Total Flight Hours" value={totalHours} unit="hrs" />
          <SparklineChart
            data={flightCounts}
            color={CHART_COLORS.primary}
            width={64}
            height={24}
          />
        </div>
      </Card>

      {/* Total Missions */}
      <Card padding={true}>
        <DataValue label="Total Missions" value={data.totalFlights} />
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2" style={{ backgroundColor: CHART_COLORS.success }} />
            <span className="text-[10px] text-text-tertiary font-mono">{completedCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2" style={{ backgroundColor: CHART_COLORS.error }} />
            <span className="text-[10px] text-text-tertiary font-mono">{failedCount}</span>
          </div>
        </div>
      </Card>

      {/* Avg Duration */}
      <Card padding={true}>
        <div className="flex items-start justify-between">
          <DataValue label="Avg Duration" value={avgDuration} />
          <SparklineChart
            data={flightCounts.slice(-14)}
            color={CHART_COLORS.secondary}
            width={64}
            height={24}
          />
        </div>
      </Card>

      {/* Fleet Utilization */}
      <Card padding={true}>
        <DataValue label="Success Rate" value={successRate} unit="%" />
        <div className="mt-2">
          <ProgressBar
            value={data.missionSuccessRate}
            color={CHART_COLORS.success}
            showLabel={false}
          />
        </div>
      </Card>
    </div>
  );
}
