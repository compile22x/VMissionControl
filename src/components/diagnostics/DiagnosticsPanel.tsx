"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EventTimeline } from "./EventTimeline";
import { MessageRatePanel } from "./MessageRatePanel";
import { DiagnosticsExport } from "./DiagnosticsExport";
import { useDiagnosticsStore } from "@/stores/diagnostics-store";
import {
  Clock,
  Activity,
  Stethoscope,
  Trash2,
} from "lucide-react";

type DiagTab = "timeline" | "rates";

export function DiagnosticsPanel() {
  const [activeTab, setActiveTab] = useState<DiagTab>("timeline");
  const clear = useDiagnosticsStore((s) => s.clear);

  return (
    <div className="h-full flex flex-col">
      {/* Top bar with tabs + actions */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border-default bg-bg-secondary">
        <Stethoscope size={14} className="text-accent-primary" />
        <span className="text-xs font-semibold text-text-primary">Diagnostics</span>

        {/* Tab toggles */}
        <div className="flex items-center gap-0.5 bg-bg-tertiary p-0.5 rounded ml-2">
          <button
            onClick={() => setActiveTab("timeline")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[10px] cursor-pointer rounded transition-colors",
              activeTab === "timeline"
                ? "bg-bg-secondary text-text-primary"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            <Clock size={10} />
            Timeline
          </button>
          <button
            onClick={() => setActiveTab("rates")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[10px] cursor-pointer rounded transition-colors",
              activeTab === "rates"
                ? "bg-bg-secondary text-text-primary"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            <Activity size={10} />
            Rates
          </button>
        </div>

        <div className="flex-1" />

        <DiagnosticsExport />

        <button
          onClick={clear}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-secondary hover:text-text-primary cursor-pointer"
        >
          <Trash2 size={10} />
          Clear All
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "timeline" && <EventTimeline />}
        {activeTab === "rates" && <MessageRatePanel />}
      </div>
    </div>
  );
}
