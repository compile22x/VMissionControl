"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Waypoint } from "@/lib/types";

interface WaypointListProps {
  waypoints: Waypoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function WaypointList({ waypoints, selectedId, onSelect, onRemove }: WaypointListProps) {
  if (waypoints.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs text-text-tertiary">No waypoints added</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {waypoints.map((wp, i) => (
        <div
          key={wp.id}
          className={cn(
            "flex items-center gap-2 px-3 py-2 border-b border-border-default cursor-pointer transition-colors",
            "hover:bg-bg-tertiary",
            selectedId === wp.id && "bg-accent-primary/10"
          )}
          onClick={() => onSelect(wp.id)}
        >
          {/* Sequence number */}
          <div className="w-5 h-5 flex items-center justify-center bg-accent-primary text-[10px] font-mono font-semibold text-white shrink-0">
            {i + 1}
          </div>

          {/* Coordinates */}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono text-text-primary truncate">
              {wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-tertiary font-mono">
              <span>{wp.alt}m</span>
              <span className="text-text-secondary">{wp.command ?? "WAYPOINT"}</span>
            </div>
          </div>

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(wp.id);
            }}
            className="text-text-tertiary hover:text-status-error transition-colors shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
