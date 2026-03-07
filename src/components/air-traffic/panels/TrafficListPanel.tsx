/**
 * @module TrafficListPanel
 * @description Right-side sortable aircraft table with threat-level color coding.
 * Shows callsign, altitude, speed, distance, and threat classification.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useMemo } from "react";
import { Plane, ChevronLeft, ArrowUpDown } from "lucide-react";
import { useTrafficStore } from "@/stores/traffic-store";
import { cn } from "@/lib/utils";
import { THREAT_COLORS, THREAT_LABELS, type AircraftState, type ThreatLevel } from "@/lib/airspace/types";

type SortKey = "callsign" | "altitude" | "speed" | "threat";
type SortDir = "asc" | "desc";

interface TrafficListPanelProps {
  onClose: () => void;
  droneLat?: number;
  droneLon?: number;
}

export function TrafficListPanel({ onClose, droneLat, droneLon }: TrafficListPanelProps) {
  const aircraft = useTrafficStore((s) => s.aircraft);
  const threatLevels = useTrafficStore((s) => s.threatLevels);
  const lastUpdate = useTrafficStore((s) => s.lastUpdate);
  const [sortKey, setSortKey] = useState<SortKey>("threat");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const aircraftList = useMemo(() => {
    const list = Array.from(aircraft.values());
    const threatOrder: Record<ThreatLevel, number> = { ra: 0, ta: 1, proximate: 2, other: 3 };

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "callsign":
          cmp = (a.callsign ?? "").localeCompare(b.callsign ?? "");
          break;
        case "altitude":
          cmp = (a.altitudeMsl ?? 0) - (b.altitudeMsl ?? 0);
          break;
        case "speed":
          cmp = (a.velocity ?? 0) - (b.velocity ?? 0);
          break;
        case "threat": {
          const ta = threatLevels.get(a.icao24) ?? "other";
          const tb = threatLevels.get(b.icao24) ?? "other";
          cmp = threatOrder[ta] - threatOrder[tb];
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [aircraft, threatLevels, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const timeSinceUpdate = lastUpdate
    ? `${Math.round((Date.now() - lastUpdate) / 1000)}s ago`
    : "No data";

  return (
    <div className="w-72 shrink-0 flex flex-col h-full border-l border-border-default bg-bg-primary/95 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-default shrink-0">
        <Plane size={12} className="text-text-tertiary" />
        <span className="text-[10px] font-mono font-bold text-text-secondary uppercase tracking-wider flex-1">
          Traffic ({aircraftList.length})
        </span>
        <span className="text-[9px] font-mono text-text-tertiary">{timeSinceUpdate}</span>
        <button
          onClick={onClose}
          className="p-0.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
        >
          <ChevronLeft size={12} />
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border-default text-[9px] font-mono text-text-tertiary uppercase">
        <SortButton label="Call" sortKey="callsign" current={sortKey} dir={sortDir} onClick={toggleSort} className="flex-1" />
        <SortButton label="Alt" sortKey="altitude" current={sortKey} dir={sortDir} onClick={toggleSort} className="w-14 text-right" />
        <SortButton label="Spd" sortKey="speed" current={sortKey} dir={sortDir} onClick={toggleSort} className="w-12 text-right" />
        <SortButton label="Thr" sortKey="threat" current={sortKey} dir={sortDir} onClick={toggleSort} className="w-8 text-center" />
      </div>

      {/* Aircraft list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {aircraftList.length === 0 && (
          <div className="flex items-center justify-center h-32 text-xs text-text-tertiary font-mono">
            No aircraft in range
          </div>
        )}
        {aircraftList.map((ac) => {
          const threat = threatLevels.get(ac.icao24) ?? "other";
          const color = THREAT_COLORS[threat];
          return (
            <div
              key={ac.icao24}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-bg-secondary/50 transition-colors text-[10px] font-mono border-b border-border-default/30"
            >
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-text-primary truncate">
                  {ac.callsign?.trim() || ac.icao24.toUpperCase()}
                </span>
              </div>
              <span className="w-14 text-right text-text-secondary">
                {ac.altitudeMsl != null ? `${Math.round(ac.altitudeMsl)}m` : "-"}
              </span>
              <span className="w-12 text-right text-text-secondary">
                {ac.velocity != null ? `${Math.round(ac.velocity)}` : "-"}
              </span>
              <span
                className="w-8 text-center text-[9px] font-bold uppercase"
                style={{ color }}
                title={THREAT_LABELS[threat]}
              >
                {threat === "ra" ? "RA" : threat === "ta" ? "TA" : threat === "proximate" ? "PRX" : "---"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortButton({
  label,
  sortKey,
  current,
  dir,
  onClick,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = current === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={cn(
        "flex items-center gap-0.5 cursor-pointer transition-colors",
        isActive ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
        className
      )}
    >
      {label}
      {isActive && (
        <ArrowUpDown size={8} className={dir === "desc" ? "rotate-180" : ""} />
      )}
    </button>
  );
}
