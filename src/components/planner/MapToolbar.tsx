/**
 * @module MapToolbar
 * @description Floating vertical tool dock for the mission planner map.
 * Provides tool selection (select, waypoint, polygon, circle, measure),
 * undo/redo, and clear-all actions.
 * @license GPL-3.0-only
 */
"use client";

import {
  MousePointer2, MapPin, Pentagon, Circle, Ruler,
  Undo2, Redo2, Trash2,
  ArrowUpFromLine, ArrowDownToLine, CircleDot, Crosshair, Flag,
} from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PlannerTool } from "@/lib/types";

interface MapToolbarProps {
  activeTool: PlannerTool;
  onToolChange: (tool: PlannerTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
}

type ToolDef = { id: PlannerTool; icon: typeof MapPin; label: string; shortcut?: string };

const navTools: ToolDef[] = [
  { id: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
];

const placementTools: ToolDef[] = [
  { id: "waypoint", icon: MapPin, label: "Waypoint", shortcut: "W" },
  { id: "takeoff", icon: ArrowUpFromLine, label: "Takeoff" },
  { id: "land", icon: ArrowDownToLine, label: "Land" },
  { id: "loiter", icon: CircleDot, label: "Loiter" },
  { id: "roi", icon: Crosshair, label: "ROI" },
  { id: "rally", icon: Flag, label: "Rally" },
];

const drawingTools: ToolDef[] = [
  { id: "polygon", icon: Pentagon, label: "Polygon", shortcut: "P" },
  { id: "circle", icon: Circle, label: "Circle", shortcut: "C" },
  { id: "measure", icon: Ruler, label: "Measure", shortcut: "M" },
];

const toolGroups: ToolDef[][] = [navTools, placementTools, drawingTools];

function ToolButton({
  active,
  disabled,
  onClick,
  children,
  tooltip,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tooltip: string;
}) {
  return (
    <Tooltip content={tooltip} position="right">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-8 h-8 flex items-center justify-center transition-colors cursor-pointer",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          active
            ? "bg-accent-primary/20 text-accent-primary"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function MapToolbar({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
}: MapToolbarProps) {
  return (
    <div className="absolute top-3 left-3 z-[1000] flex flex-col bg-bg-secondary/95 border border-border-default">
      {toolGroups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="h-px bg-border-default" />}
          {group.map((t) => (
            <ToolButton
              key={t.id}
              active={activeTool === t.id}
              onClick={() => onToolChange(t.id)}
              tooltip={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
            >
              <t.icon size={16} />
            </ToolButton>
          ))}
        </div>
      ))}

      <div className="h-px bg-border-default" />

      <ToolButton
        disabled={!canUndo}
        onClick={onUndo}
        tooltip="Undo (Cmd+Z)"
      >
        <Undo2 size={16} />
      </ToolButton>
      <ToolButton
        disabled={!canRedo}
        onClick={onRedo}
        tooltip="Redo (Cmd+Shift+Z)"
      >
        <Redo2 size={16} />
      </ToolButton>

      <div className="h-px bg-border-default" />

      <ToolButton onClick={onClearAll} tooltip="Clear All">
        <Trash2 size={16} />
      </ToolButton>
    </div>
  );
}
