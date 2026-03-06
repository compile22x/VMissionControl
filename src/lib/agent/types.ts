/**
 * @module AgentTypes
 * @description TypeScript types for the ADOS Drone Agent REST API.
 * @license GPL-3.0-only
 */

export interface AgentStatus {
  version: string;
  uptime_seconds: number;
  device_id: string;
  name: string;
  tier: number;
  board: string;
  os: string;
  fc_connected: boolean;
  fc_port: string;
  fc_baud: number;
  armed: boolean;
  mode: string;
  gps_fix: number;
  satellites: number;
}

export interface ServiceInfo {
  name: string;
  status: "running" | "stopped" | "error";
  pid: number | null;
  cpu_percent: number;
  memory_mb: number;
  uptime_seconds: number;
}

export interface SystemResources {
  cpu_percent: number;
  memory_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
  disk_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  temperature: number | null;
}

export interface TelemetrySnapshot {
  lat: number;
  lon: number;
  alt: number;
  relative_alt: number;
  heading: number;
  groundspeed: number;
  airspeed: number;
  roll: number;
  pitch: number;
  yaw: number;
  battery_voltage: number;
  battery_current: number;
  battery_remaining: number;
  gps_fix: number;
  satellites: number;
  mode: string;
  armed: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warning" | "error";
  service: string;
  message: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}
