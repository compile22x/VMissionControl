"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMissionStore } from "@/stores/mission-store";
import { DataValue } from "@/components/ui/data-value";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { SuiteType } from "@/lib/types";
import { cn } from "@/lib/utils";

function SentryDashboard({ progress }: { progress: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
          Patrol Progress
        </span>
        <ProgressBar value={progress} showLabel />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DataValue label="Area Covered" value="1.2" unit="km\u00B2" />
        <DataValue label="Laps" value="3" />
        <DataValue label="Detections" value="0" />
        <DataValue label="Alerts" value="0" />
      </div>
    </div>
  );
}

function SurveyDashboard({ progress }: { progress: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
          Coverage
        </span>
        <ProgressBar value={progress} showLabel />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DataValue label="Images" value="142" />
        <DataValue label="Overlap" value="78" unit="%" />
        <DataValue label="GSD" value="2.1" unit="cm/px" />
        <DataValue label="Area" value="0.8" unit="km\u00B2" />
      </div>
    </div>
  );
}

function SarDashboard({ progress }: { progress: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
          Grid Progress
        </span>
        <ProgressBar value={progress} showLabel />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DataValue label="Search Area" value="2.4" unit="km\u00B2" />
        <DataValue label="Persons Found" value="0" />
        <DataValue label="Grid Cells" value={`${Math.round(progress / 10)}/10`} />
        <DataValue label="Thermal Hits" value="3" />
      </div>
    </div>
  );
}

function GenericDashboard({ progress }: { progress: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
          Mission Progress
        </span>
        <ProgressBar value={progress} showLabel />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DataValue label="Waypoints" value={`${Math.round(progress / 10)}/10`} />
        <DataValue label="Distance" value="2.1" unit="km" />
      </div>
    </div>
  );
}

function getSuiteDashboard(
  suiteType: SuiteType | undefined,
  progress: number
) {
  switch (suiteType) {
    case "sentry":
      return <SentryDashboard progress={progress} />;
    case "survey":
      return <SurveyDashboard progress={progress} />;
    case "sar":
      return <SarDashboard progress={progress} />;
    default:
      return <GenericDashboard progress={progress} />;
  }
}

const SUITE_LABELS: Record<string, string> = {
  sentry: "Sentry",
  survey: "Survey",
  sar: "SAR",
  agriculture: "Agriculture",
  cargo: "Cargo",
  inspection: "Inspection",
};

export function SuiteDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const mission = useMissionStore((s) => s.activeMission);
  const progress = useMissionStore((s) => s.progress);

  if (!mission) return null;

  const suiteLabel = mission.suiteType
    ? SUITE_LABELS[mission.suiteType] ?? mission.suiteType
    : "Mission";

  return (
    <div className="border-t border-border-default">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-bg-tertiary transition-colors cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
          {suiteLabel} Dashboard
        </span>
        {collapsed ? (
          <ChevronDown size={12} className="text-text-tertiary" />
        ) : (
          <ChevronUp size={12} className="text-text-tertiary" />
        )}
      </button>

      {/* Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          collapsed ? "max-h-0" : "max-h-96"
        )}
      >
        <div className="px-3 pb-3">
          {/* Mission name */}
          <p className="text-xs text-text-secondary mb-2 truncate">
            {mission.name}
          </p>
          {getSuiteDashboard(mission.suiteType, progress || mission.progress)}
        </div>
      </div>
    </div>
  );
}
