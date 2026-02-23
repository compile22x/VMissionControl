"use client";

import { useState, useMemo } from "react";
import { PeriodSelector } from "@/components/analytics/PeriodSelector";
import { AnalyticsStatCards } from "@/components/analytics/AnalyticsStatCards";
import { FlightTrendChart } from "@/components/analytics/FlightTrendChart";
import { UtilizationChart } from "@/components/analytics/UtilizationChart";
import { BatteryHealthChart } from "@/components/analytics/BatteryHealthChart";
import { DronePerformanceGrid } from "@/components/analytics/DronePerformanceGrid";
import { generateAnalytics } from "@/mock/analytics";
import { getFlightHistory } from "@/mock/history";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("30d");

  const analytics = useMemo(() => generateAnalytics(), []);
  const flights = useMemo(() => getFlightHistory(), []);

  // Filter flights based on selected period
  const filteredFlightsPerDay = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let days = 30;
    if (period === "7d") days = 7;
    else if (period === "90d") days = 90;
    else if (period === "all") days = 365;

    if (period === "all") return analytics.flightsPerDay;

    return analytics.flightsPerDay.slice(-days);
  }, [analytics.flightsPerDay, period]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
        <h1 className="text-sm font-display font-semibold text-text-primary">Analytics</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 p-4 overflow-y-auto">
        {/* Stat Cards */}
        <AnalyticsStatCards data={analytics} />

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-4">
          <FlightTrendChart data={filteredFlightsPerDay} />
          <UtilizationChart data={analytics.utilizationByDrone} />
        </div>

        {/* Battery Chart */}
        <BatteryHealthChart data={analytics.batteryDegradation} />

        {/* Drone Performance Grid */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Drone Performance
          </h2>
          <DronePerformanceGrid analytics={analytics} flights={flights} />
        </div>
      </div>
    </div>
  );
}
