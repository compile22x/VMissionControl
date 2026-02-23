"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import {
  Cpu,
  Gauge,
  Zap,
  Fan,
  Radio,
  Camera,
  Navigation,
  Battery,
  Box,
  Activity,
} from "lucide-react";
import type { HardwareComponent } from "@/lib/types";

type HardwareNodeData = HardwareComponent & { label?: string };

const typeIcons: Record<HardwareComponent["type"], typeof Cpu> = {
  compute: Cpu,
  fc: Gauge,
  esc: Zap,
  motor: Fan,
  radio: Radio,
  camera: Camera,
  gps: Navigation,
  battery: Battery,
  frame: Box,
  sensor: Activity,
};

const typeBorderColors: Record<HardwareComponent["type"], string> = {
  compute: "border-l-accent-primary",
  fc: "border-l-accent-secondary",
  esc: "border-l-status-warning",
  motor: "border-l-status-success",
  radio: "border-l-[#a855f7]",
  camera: "border-l-[#ec4899]",
  gps: "border-l-[#06b6d4]",
  battery: "border-l-status-error",
  frame: "border-l-text-tertiary",
  sensor: "border-l-[#f97316]",
};

const statusToDot: Record<string, "online" | "idle" | "warning" | "error" | "offline"> = {
  ok: "online",
  warning: "warning",
  error: "error",
  offline: "offline",
};

function HardwareNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as HardwareNodeData;
  const Icon = typeIcons[nodeData.type] || Box;

  return (
    <div
      className={cn(
        "bg-bg-secondary border border-border-default border-l-2 px-3 py-2 min-w-[140px]",
        typeBorderColors[nodeData.type]
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border-strong !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2 mb-1">
        <Icon size={12} className="text-text-tertiary shrink-0" />
        <span className="text-[11px] font-semibold text-text-primary truncate">
          {nodeData.name}
        </span>
        <StatusDot status={statusToDot[nodeData.status] || "offline"} className="shrink-0 ml-auto" />
      </div>
      <span className="text-[9px] uppercase tracking-wider text-text-tertiary">
        {nodeData.type}
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-border-strong !w-2 !h-2 !border-0" />
    </div>
  );
}

export const HardwareNode = memo(HardwareNodeComponent);
