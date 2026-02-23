"use client";

import { DashboardMap } from "@/components/dashboard/DashboardMap";
import { FleetStatusCard } from "@/components/dashboard/FleetStatusCard";
import { ActiveMissionsCard } from "@/components/dashboard/ActiveMissionsCard";
import { AvgBatteryCard } from "@/components/dashboard/AvgBatteryCard";
import { AlertsCountCard } from "@/components/dashboard/AlertsCountCard";
import { AlertFeed } from "@/components/dashboard/AlertFeed";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";

export default function DashboardPage() {
  return (
    <div className="flex-1 flex flex-col h-full overflow-auto p-3 gap-3">
      {/* Top bento grid: Map + Status cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 min-h-0">
        {/* Map — left 60% */}
        <div className="lg:col-span-3 border border-border-default bg-bg-secondary min-h-[320px]">
          <DashboardMap />
        </div>

        {/* Right 40% — 4 status cards stacked */}
        <div className="lg:col-span-2 grid grid-rows-4 gap-3">
          <FleetStatusCard />
          <ActiveMissionsCard />
          <AvgBatteryCard />
          <AlertsCountCard />
        </div>
      </div>

      {/* Alert feed */}
      <AlertFeed />

      {/* Quick actions bar */}
      <div className="border border-border-default bg-bg-secondary px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Quick Actions
          </span>
          <QuickActionsBar />
        </div>
      </div>
    </div>
  );
}
