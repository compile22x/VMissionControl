"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import {
  FileText,
  Download,
  Trash2,
  Filter,
  Pause,
  Play,
  Activity,
  Gauge,
  Battery,
  Signal,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface LogMessage {
  id: number;
  timestamp: number;
  severity: number;
  text: string;
}

// ── Severity mapping ─────────────────────────────────────────

const SEVERITY_LABELS = [
  "EMERGENCY",
  "ALERT",
  "CRITICAL",
  "ERROR",
  "WARNING",
  "NOTICE",
  "INFO",
  "DEBUG",
] as const;

const SEVERITY_COLORS: Record<number, string> = {
  0: "text-red-500",
  1: "text-red-500",
  2: "text-red-400",
  3: "text-red-400",
  4: "text-yellow-400",
  5: "text-blue-400",
  6: "text-green-400",
  7: "text-text-tertiary",
};

const SEVERITY_BG: Record<number, string> = {
  0: "bg-red-500/10",
  1: "bg-red-500/10",
  2: "bg-red-400/10",
  3: "bg-red-400/10",
  4: "bg-yellow-400/10",
  5: "bg-blue-400/10",
  6: "bg-green-400/10",
  7: "bg-transparent",
};

const MAX_LOG_MESSAGES = 1000;

// ── Graph channel config ─────────────────────────────────────

const GRAPH_CHANNELS = [
  { key: "altitude" as const, label: "Altitude", icon: Activity, color: "#3A82FF" },
  { key: "speed" as const, label: "Speed", icon: Gauge, color: "#DFF140" },
  { key: "battery" as const, label: "Battery V", icon: Battery, color: "#22c55e" },
  { key: "rssi" as const, label: "RSSI", icon: Signal, color: "#f97316" },
] as const;

type ChannelKey = (typeof GRAPH_CHANNELS)[number]["key"];

// ── Component ────────────────────────────────────────────────

export default function LogsPage() {
  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);

  // Status message log
  const [messages, setMessages] = useState<LogMessage[]>([]);
  const [minSeverity, setMinSeverity] = useState(7); // Show all by default
  const [autoscroll, setAutoscroll] = useState(true);

  // Graph
  const [showGraph, setShowGraph] = useState(true);
  const [activeChannels, setActiveChannels] = useState<Record<ChannelKey, boolean>>({
    altitude: true,
    speed: false,
    battery: false,
    rssi: false,
  });

  const logRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);

  // ── Subscribe to STATUSTEXT messages from the protocol ─────

  useEffect(() => {
    const protocol = getProtocol();
    if (!protocol) return;

    const unsub = protocol.onStatusText((data) => {
      setMessages((prev) => {
        const msg: LogMessage = {
          id: msgIdRef.current++,
          timestamp: Date.now(),
          severity: data.severity,
          text: data.text,
        };
        const next = [...prev, msg];
        return next.length > MAX_LOG_MESSAGES ? next.slice(-MAX_LOG_MESSAGES) : next;
      });
    });

    return unsub;
  }, [getProtocol, selectedDroneId]);

  // ── Auto-scroll log to bottom ──────────────────────────────

  useEffect(() => {
    if (autoscroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, autoscroll]);

  // ── Build graph data from telemetry ring buffers ───────────
  // RingBuffer<T>.toArray() returns T[] oldest-first.
  // VFR buffer is the time axis; battery and RC are sampled at
  // different rates, so we index-align to the VFR array length.

  const vfrBuffer = useTelemetryStore((s) => s.vfr);
  const batteryBuffer = useTelemetryStore((s) => s.battery);
  const rcBuffer = useTelemetryStore((s) => s.rc);

  const vfrArr = vfrBuffer.toArray();
  const batteryArr = batteryBuffer.toArray();
  const rcArr = rcBuffer.toArray();

  const graphData = vfrArr.map((v, i) => ({
    time: i,
    altitude: v.alt,
    speed: v.groundspeed,
    battery: batteryArr[Math.min(i, batteryArr.length - 1)]?.voltage ?? 0,
    rssi: rcArr[Math.min(i, rcArr.length - 1)]?.rssi ?? 0,
  }));

  // ── Filtered messages ──────────────────────────────────────

  const filteredMessages = messages.filter((m) => m.severity <= minSeverity);

  // ── Export log to text file ────────────────────────────────

  const exportLog = useCallback(() => {
    const lines = filteredMessages.map((m) => {
      const time = new Date(m.timestamp).toISOString();
      const sev = SEVERITY_LABELS[m.severity] ?? "UNKNOWN";
      return `[${time}] [${sev}] ${m.text}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `altnautica-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredMessages]);

  // ── Helpers ────────────────────────────────────────────────

  const toggleChannel = (key: ChannelKey) => {
    setActiveChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full flex">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="w-[200px] border-r border-border-default bg-bg-secondary flex-shrink-0 flex flex-col">
        {/* Header */}
        <div className="px-3 py-3 border-b border-border-default">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Flight Logs
          </h2>
        </div>

        {/* Severity filter */}
        <div className="p-3 border-b border-border-default space-y-2">
          <label className="text-[10px] text-text-tertiary uppercase tracking-wider flex items-center gap-1">
            <Filter size={10} />
            Min Severity
          </label>
          <select
            value={minSeverity}
            onChange={(e) => setMinSeverity(Number(e.target.value))}
            className="w-full bg-bg-tertiary text-text-primary text-xs px-2 py-1.5 border border-border-default focus:outline-none focus:border-accent-primary"
          >
            {SEVERITY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Graph channel toggles */}
        <div className="p-3 border-b border-border-default space-y-1">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-2">
            Graph Channels
          </p>
          {GRAPH_CHANNELS.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => toggleChannel(key)}
              className={`flex items-center gap-2 w-full px-2 py-1 text-xs text-left transition-colors cursor-pointer ${
                activeChannels[key] ? "text-text-primary" : "text-text-tertiary"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: activeChannels[key] ? color : "#333" }}
              />
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="p-3 space-y-1">
          <button
            onClick={exportLog}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            <Download size={12} />
            Export Log
          </button>
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
            Clear Log
          </button>
          <button
            onClick={() => setShowGraph((p) => !p)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            <Activity size={12} />
            {showGraph ? "Hide Graph" : "Show Graph"}
          </button>
        </div>

        {/* Onboard logs placeholder */}
        <div className="mt-auto p-3 border-t border-border-default">
          <p className="text-[10px] text-text-tertiary uppercase tracking-wider mb-2">
            Onboard Logs
          </p>
          {selectedDroneId ? (
            <p className="text-[10px] text-text-tertiary italic">
              Log download coming soon
            </p>
          ) : (
            <p className="text-[10px] text-text-tertiary italic">
              Connect to view FC logs
            </p>
          )}
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Log header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-default bg-bg-secondary">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-text-secondary" />
            <span className="text-xs font-semibold text-text-primary">
              Status Messages
            </span>
            <span className="text-[10px] text-text-tertiary font-mono">
              {filteredMessages.length} msgs
            </span>
          </div>
          <button
            onClick={() => setAutoscroll((p) => !p)}
            className={`flex items-center gap-1 px-2 py-1 text-[10px] transition-colors cursor-pointer ${
              autoscroll ? "text-accent-primary" : "text-text-tertiary"
            }`}
          >
            {autoscroll ? <Play size={10} /> : <Pause size={10} />}
            {autoscroll ? "Auto-scroll" : "Paused"}
          </button>
        </div>

        {/* Message list */}
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto font-mono text-[11px] leading-5"
          onMouseEnter={() => setAutoscroll(false)}
          onMouseLeave={() => setAutoscroll(true)}
        >
          {filteredMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
              {selectedDroneId
                ? "Waiting for status messages..."
                : "Connect a drone to see status messages"}
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 px-4 py-0.5 hover:bg-bg-tertiary/50 ${
                  SEVERITY_BG[msg.severity] ?? ""
                }`}
              >
                <span className="text-text-tertiary shrink-0 w-[60px]">
                  {formatTime(msg.timestamp)}
                </span>
                <span
                  className={`shrink-0 w-[72px] font-semibold ${
                    SEVERITY_COLORS[msg.severity] ?? "text-text-tertiary"
                  }`}
                >
                  {SEVERITY_LABELS[msg.severity] ?? "?"}
                </span>
                <span className="text-text-primary break-all">{msg.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Telemetry graph */}
        {showGraph && (
          <div className="h-[200px] border-t border-border-default bg-bg-secondary p-2 shrink-0">
            {graphData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData}>
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "#666" }}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#666" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111116",
                      border: "1px solid #333",
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "#888" }}
                  />
                  {activeChannels.altitude && (
                    <Line
                      type="monotone"
                      dataKey="altitude"
                      stroke="#3A82FF"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  )}
                  {activeChannels.speed && (
                    <Line
                      type="monotone"
                      dataKey="speed"
                      stroke="#DFF140"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  )}
                  {activeChannels.battery && (
                    <Line
                      type="monotone"
                      dataKey="battery"
                      stroke="#22c55e"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  )}
                  {activeChannels.rssi && (
                    <Line
                      type="monotone"
                      dataKey="rssi"
                      stroke="#f97316"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-text-tertiary text-xs">
                Telemetry data will appear here when connected
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
