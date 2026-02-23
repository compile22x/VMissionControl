"use client";

import { useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useHardwareStore } from "@/stores/hardware-store";
import { MOCK_HARDWARE_COMPONENTS, MOCK_HARDWARE_CONNECTIONS } from "@/mock/hardware";
import { HardwareNode } from "./HardwareNode";
import { HardwareEdge } from "./HardwareEdge";
import type { HardwareComponent } from "@/lib/types";

const nodeTypes = { hardware: HardwareNode };
const edgeTypes = { hardware: HardwareEdge };

/**
 * Position nodes in a logical layout:
 * - Compute at top center
 * - FC below compute
 * - Sensors to the left
 * - Cameras + Radios to the right
 * - ESCs below FC
 * - Motors at bottom
 * - Battery bottom-left
 * - Frame bottom-right
 */
function getNodePosition(comp: HardwareComponent, index: number): { x: number; y: number } {
  const positions: Record<string, { x: number; y: number }> = {
    // Compute
    "cm4": { x: 340, y: 20 },
    // FC
    "stm32": { x: 340, y: 130 },
    // Sensors (left column)
    "imu1": { x: 20, y: 100 },
    "imu2": { x: 20, y: 190 },
    "baro": { x: 20, y: 280 },
    "mag": { x: 170, y: 280 },
    // GPS
    "gps1": { x: 170, y: 190 },
    // Cameras (right column)
    "cam-main": { x: 560, y: 20 },
    "cam-thermal": { x: 560, y: 110 },
    // Radios (far right)
    "radio-wifi": { x: 720, y: 20 },
    "radio-4g": { x: 720, y: 110 },
    // ESCs (row below FC)
    "esc1": { x: 160, y: 370 },
    "esc2": { x: 320, y: 370 },
    "esc3": { x: 480, y: 370 },
    "esc4": { x: 640, y: 370 },
    // Motors (bottom row)
    "motor1": { x: 160, y: 470 },
    "motor2": { x: 320, y: 470 },
    "motor3": { x: 480, y: 470 },
    "motor4": { x: 640, y: 470 },
    // Battery
    "battery": { x: 20, y: 400 },
    // Frame
    "frame": { x: 720, y: 400 },
  };

  return positions[comp.id] || { x: 100 + (index % 5) * 180, y: 100 + Math.floor(index / 5) * 120 };
}

const typeBgColors: Record<HardwareComponent["type"], string> = {
  compute: "#3a82ff",
  fc: "#dff140",
  esc: "#f59e0b",
  motor: "#22c55e",
  radio: "#a855f7",
  camera: "#ec4899",
  gps: "#06b6d4",
  battery: "#ef4444",
  frame: "#666666",
  sensor: "#f97316",
};

export function DroneArchitectureTab() {
  const setComponents = useHardwareStore((s) => s.setComponents);
  const setConnections = useHardwareStore((s) => s.setConnections);

  useEffect(() => {
    setComponents(MOCK_HARDWARE_COMPONENTS);
    setConnections(MOCK_HARDWARE_CONNECTIONS);
  }, [setComponents, setConnections]);

  const nodes: Node[] = useMemo(
    () =>
      MOCK_HARDWARE_COMPONENTS.map((comp, i) => ({
        id: comp.id,
        type: "hardware",
        position: getNodePosition(comp, i),
        data: { ...comp },
      })),
    []
  );

  const edges: Edge[] = useMemo(
    () =>
      MOCK_HARDWARE_CONNECTIONS.map((conn) => ({
        id: conn.id,
        source: conn.source,
        target: conn.target,
        type: "hardware",
        data: { protocol: conn.protocol, label: conn.label },
      })),
    []
  );

  const onInit = useCallback(() => {
    // React Flow initialized
  }, []);

  // Legend items
  const legendItems = [
    { type: "compute", label: "Compute" },
    { type: "fc", label: "Flight Controller" },
    { type: "sensor", label: "Sensor" },
    { type: "camera", label: "Camera" },
    { type: "radio", label: "Radio" },
    { type: "gps", label: "GPS" },
    { type: "esc", label: "ESC" },
    { type: "motor", label: "Motor" },
    { type: "battery", label: "Battery" },
    { type: "frame", label: "Frame" },
  ] as const;

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-border-default bg-bg-secondary">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary mr-1">
          Legend
        </span>
        {legendItems.map((item) => (
          <div key={item.type} className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5"
              style={{ backgroundColor: typeBgColors[item.type] }}
            />
            <span className="text-[10px] text-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>

      {/* React Flow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={onInit}
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        >
          <Background color="#1a1a1a" gap={20} />
          <Controls
            showInteractive={false}
            style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
