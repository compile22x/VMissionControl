/**
 * @module WaypointListItem
 * @description Individual waypoint row in the right panel list. Shows compact view
 * (sequence badge, command letter, altitude) and expandable inline editor for
 * lat/lon/alt/speed/command/hold-time. Supports drag-and-drop reordering.
 * @license GPL-3.0-only
 */
"use client";

import { useState, useCallback, useEffect } from "react";
import { GripVertical, X, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Waypoint, WaypointCommand } from "@/lib/types";

const COMMAND_OPTIONS: { value: WaypointCommand; label: string }[] = [
  { value: "WAYPOINT", label: "Waypoint" },
  { value: "TAKEOFF", label: "Takeoff" },
  { value: "LAND", label: "Land" },
  { value: "LOITER", label: "Loiter" },
  { value: "LOITER_TIME", label: "Loiter (Time)" },
  { value: "LOITER_TURNS", label: "Loiter (Turns)" },
  { value: "RTL", label: "Return to Launch" },
  { value: "ROI", label: "Region of Interest" },
  { value: "DO_SET_SPEED", label: "Set Speed" },
  { value: "DO_SET_CAM_TRIGG", label: "Camera Trigger" },
  { value: "DO_DIGICAM", label: "Camera Control" },
  { value: "DO_JUMP", label: "Jump to WP" },
  { value: "DELAY", label: "Delay" },
  { value: "CONDITION_YAW", label: "Set Yaw" },
];

const CMD_LETTER: Record<string, string> = {
  TAKEOFF: "T",
  WAYPOINT: "W",
  LOITER: "L",
  LOITER_TIME: "L",
  LOITER_TURNS: "L",
  RTL: "R",
  LAND: "D",
  ROI: "O",
  DO_SET_SPEED: "S",
  DELAY: "Y",
  CONDITION_YAW: "Y",
  DO_SET_CAM_TRIGG: "C",
  DO_DIGICAM: "C",
  DO_JUMP: "J",
};

interface WaypointListItemProps {
  waypoint: Waypoint;
  index: number;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onUpdate: (update: Partial<Waypoint>) => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
  dragOver: boolean;
}

export function WaypointListItem({
  waypoint,
  index,
  expanded,
  selected,
  onToggleExpand,
  onSelect,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  dragOver,
}: WaypointListItemProps) {
  const cmd = waypoint.command ?? "WAYPOINT";
  const letter = CMD_LETTER[cmd] ?? "W";

  // Local state for editable fields — initialized from props, committed on blur
  const [localLat, setLocalLat] = useState(waypoint.lat.toFixed(6));
  const [localLon, setLocalLon] = useState(waypoint.lon.toFixed(6));
  const [localAlt, setLocalAlt] = useState(String(waypoint.alt));
  const [localSpeed, setLocalSpeed] = useState(
    waypoint.speed !== undefined ? String(waypoint.speed) : ""
  );
  const [localHoldTime, setLocalHoldTime] = useState(
    waypoint.holdTime !== undefined ? String(waypoint.holdTime) : ""
  );
  const [localParam1, setLocalParam1] = useState(
    waypoint.param1 !== undefined ? String(waypoint.param1) : ""
  );
  const [localParam2, setLocalParam2] = useState(
    waypoint.param2 !== undefined ? String(waypoint.param2) : ""
  );
  const [localParam3, setLocalParam3] = useState(
    waypoint.param3 !== undefined ? String(waypoint.param3) : ""
  );

  // Re-sync local state when props change (e.g. from map drag or undo)
  useEffect(() => { setLocalLat(waypoint.lat.toFixed(6)); }, [waypoint.lat]);
  useEffect(() => { setLocalLon(waypoint.lon.toFixed(6)); }, [waypoint.lon]);
  useEffect(() => { setLocalAlt(String(waypoint.alt)); }, [waypoint.alt]);
  useEffect(() => {
    setLocalSpeed(waypoint.speed !== undefined ? String(waypoint.speed) : "");
  }, [waypoint.speed]);
  useEffect(() => {
    setLocalHoldTime(waypoint.holdTime !== undefined ? String(waypoint.holdTime) : "");
  }, [waypoint.holdTime]);
  useEffect(() => {
    setLocalParam1(waypoint.param1 !== undefined ? String(waypoint.param1) : "");
  }, [waypoint.param1]);
  useEffect(() => {
    setLocalParam2(waypoint.param2 !== undefined ? String(waypoint.param2) : "");
  }, [waypoint.param2]);
  useEffect(() => {
    setLocalParam3(waypoint.param3 !== undefined ? String(waypoint.param3) : "");
  }, [waypoint.param3]);

  const commitField = useCallback(
    (field: keyof Waypoint, value: string) => {
      if (value === "" && (field === "speed" || field === "holdTime")) {
        onUpdate({ [field]: undefined });
        return;
      }
      const num = parseFloat(value);
      if (!isNaN(num)) {
        onUpdate({ [field]: num });
      }
    },
    [onUpdate]
  );

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={cn(
        "border-b border-border-default transition-colors",
        selected && "bg-accent-primary/5",
        dragOver && "border-t-2 border-t-accent-primary"
      )}
    >
      {/* Compact row */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-bg-tertiary"
        onClick={onSelect}
      >
        <GripVertical size={12} className="text-text-tertiary shrink-0 cursor-grab" />

        {/* Seq badge */}
        <div className="w-5 h-5 flex items-center justify-center bg-accent-primary text-[10px] font-mono font-semibold text-white shrink-0">
          {index + 1}
        </div>

        {/* Command letter */}
        <div className="w-5 h-5 flex items-center justify-center bg-bg-tertiary text-[10px] font-mono font-semibold text-text-secondary shrink-0 border border-border-default">
          {letter}
        </div>

        {/* Command name + alt */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[11px] font-mono text-text-primary truncate">{cmd}</span>
          <span className="text-[10px] font-mono text-text-tertiary">{waypoint.alt}m</span>
        </div>

        {/* Expand toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="text-text-tertiary hover:text-text-primary shrink-0 cursor-pointer"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-text-tertiary hover:text-status-error transition-colors shrink-0 cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>

      {/* Expanded inline edit */}
      {expanded && (
        <div className="px-3 pb-2 pt-1 flex flex-col gap-2 bg-bg-tertiary/50">
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Lat"
              type="number"
              step="0.0001"
              value={localLat}
              onChange={(e) => setLocalLat(e.target.value)}
              onBlur={() => commitField("lat", localLat)}
            />
            <Input
              label="Lon"
              type="number"
              step="0.0001"
              value={localLon}
              onChange={(e) => setLocalLon(e.target.value)}
              onBlur={() => commitField("lon", localLon)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Alt"
              type="number"
              unit="m"
              value={localAlt}
              onChange={(e) => setLocalAlt(e.target.value)}
              onBlur={() => commitField("alt", localAlt)}
            />
            <Input
              label="Speed"
              type="number"
              unit="m/s"
              placeholder="default"
              value={localSpeed}
              onChange={(e) => setLocalSpeed(e.target.value)}
              onBlur={() => commitField("speed", localSpeed)}
            />
          </div>
          <Select
            label="Command"
            options={COMMAND_OPTIONS}
            value={cmd}
            onChange={(v) => onUpdate({ command: v as WaypointCommand })}
          />
          {(cmd === "LOITER" || cmd === "LOITER_TIME") && (
            <Input
              label="Hold Time"
              type="number"
              unit="s"
              placeholder="0"
              value={localHoldTime}
              onChange={(e) => setLocalHoldTime(e.target.value)}
              onBlur={() => commitField("holdTime", localHoldTime)}
            />
          )}
          {cmd === "LOITER_TURNS" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Turns"
                type="number"
                placeholder="1"
                value={localParam1}
                onChange={(e) => setLocalParam1(e.target.value)}
                onBlur={() => commitField("param1", localParam1)}
              />
              <Input
                label="Radius"
                type="number"
                unit="m"
                placeholder="0"
                value={localParam3}
                onChange={(e) => setLocalParam3(e.target.value)}
                onBlur={() => commitField("param3", localParam3)}
              />
            </div>
          )}
          {cmd === "DO_JUMP" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Target WP"
                type="number"
                placeholder="1"
                value={localParam1}
                onChange={(e) => setLocalParam1(e.target.value)}
                onBlur={() => commitField("param1", localParam1)}
              />
              <Input
                label="Repeat"
                type="number"
                placeholder="1"
                value={localParam2}
                onChange={(e) => setLocalParam2(e.target.value)}
                onBlur={() => commitField("param2", localParam2)}
              />
            </div>
          )}
          {cmd === "CONDITION_YAW" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Angle"
                type="number"
                unit="deg"
                placeholder="0"
                value={localParam1}
                onChange={(e) => setLocalParam1(e.target.value)}
                onBlur={() => commitField("param1", localParam1)}
              />
              <Input
                label="Rate"
                type="number"
                unit="deg/s"
                placeholder="0"
                value={localParam2}
                onChange={(e) => setLocalParam2(e.target.value)}
                onBlur={() => commitField("param2", localParam2)}
              />
            </div>
          )}
          {cmd === "DO_SET_CAM_TRIGG" && (
            <Input
              label="Trigger Distance"
              type="number"
              unit="m"
              placeholder="0"
              value={localParam1}
              onChange={(e) => setLocalParam1(e.target.value)}
              onBlur={() => commitField("param1", localParam1)}
            />
          )}
        </div>
      )}
    </div>
  );
}
