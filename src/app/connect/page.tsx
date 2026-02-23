"use client";

import { useState, useEffect, useCallback } from "react";
import { SerialPanel } from "@/components/connect/SerialPanel";
import { WebSocketPanel } from "@/components/connect/WebSocketPanel";
import { ActiveConnections } from "@/components/connect/ActiveConnections";
import { ConnectionPresets } from "@/components/connect/ConnectionPresets";
import { useDroneManager } from "@/stores/drone-manager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import {
  Usb,
  Wifi,
  History,
  RotateCw,
  Trash2,
  Star,
  Save,
  Radio,
  Zap,
} from "lucide-react";
import { formatDate, formatTime, randomId } from "@/lib/utils";
import { WebSerialTransport } from "@/lib/protocol/transport-webserial";
import { WebSocketTransport } from "@/lib/protocol/transport-websocket";
import { MAVLinkAdapter } from "@/lib/protocol/mavlink-adapter";
import { serialPortManager } from "@/lib/serial-port-manager";
import {
  savePreset,
  type ConnectionPreset,
} from "@/lib/connection-presets";

// ── Recent connections (localStorage) ──────────────────────

export interface RecentConnection {
  type: "serial" | "websocket";
  baudRate?: number;
  url?: string;
  name: string;
  date: number;
}

const RECENT_KEY = "command:recent-connections";

export function saveRecentConnection(conn: RecentConnection) {
  try {
    const existing: RecentConnection[] = JSON.parse(
      localStorage.getItem(RECENT_KEY) || "[]",
    );
    existing.unshift(conn);
    localStorage.setItem(RECENT_KEY, JSON.stringify(existing.slice(0, 10)));
  } catch {
    /* ignore */
  }
}

// ── Connection tabs ────────────────────────────────────────

const CONNECTION_TABS = [
  { id: "serial", label: "USB Serial" },
  { id: "websocket", label: "WebSocket" },
];

// ── Page ───────────────────────────────────────────────────

export default function ConnectPage() {
  const [tab, setTab] = useState("serial");
  const droneCount = useDroneManager((s) => s.drones.size);
  const [presetsKey, setPresetsKey] = useState(0);
  const [dfuDetected, setDfuDetected] = useState(false);

  // DFU hot-plug detection
  useEffect(() => {
    if (typeof navigator === "undefined" || !("usb" in navigator)) return;
    if (typeof window !== "undefined" && !window.isSecureContext) return;

    const checkDfu = () => {
      navigator.usb.getDevices().then((devices) => {
        const hasDfu = devices.some((d) =>
          (d.vendorId === 0x0483 && d.productId === 0xdf11) ||
          (d.vendorId === 0x2e3c && d.productId === 0x0788) ||
          (d.vendorId === 0x29ac && d.productId === 0x0003) ||
          (d.vendorId === 0x2b04 && d.productId === 0xd058)
        );
        setDfuDetected(hasDfu);
      }).catch(() => {});
    };

    checkDfu();

    const onConnect = () => checkDfu();
    const onDisconnect = () => checkDfu();
    navigator.usb.addEventListener("connect", onConnect);
    navigator.usb.addEventListener("disconnect", onDisconnect);
    return () => {
      navigator.usb.removeEventListener("connect", onConnect);
      navigator.usb.removeEventListener("disconnect", onDisconnect);
    };
  }, []);

  // Shared connection handler — saves to recent + optionally refreshes presets
  const handleConnected = useCallback(
    (name: string, type: "serial" | "websocket", detail: string | number) => {
      saveRecentConnection({
        type,
        name,
        date: Date.now(),
        ...(type === "serial"
          ? { baudRate: detail as number }
          : { url: detail as string }),
      });
    },
    [],
  );

  function handleSerialConnected(name: string, _type: "serial", baudRate: number) {
    handleConnected(name, "serial", baudRate);
  }

  function handleWsConnected(name: string, _type: "websocket", url: string) {
    handleConnected(name, "websocket", url);
  }

  function handleSavePreset() {
    const presetName = prompt("Preset name:");
    if (!presetName) return;

    const preset: ConnectionPreset = {
      id: randomId(),
      name: presetName,
      type: tab as "serial" | "websocket",
      config:
        tab === "serial" ? { baudRate: 115200 } : { url: "ws://localhost:14550" },
      createdAt: Date.now(),
    };
    savePreset(preset);
    setPresetsKey((k) => k + 1);
  }

  function handleApplyPreset(preset: ConnectionPreset) {
    setTab(preset.type);
    // The panel components will use their own state — preset apply is a tab switch
    // For WebSocket, we could pass the URL, but keeping it simple for now
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold text-text-primary">
              Connect
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Connect to flight controllers via USB or network
            </p>
          </div>
          {droneCount > 0 && (
            <Badge variant="success" size="md">
              <Radio size={10} className="mr-1" />
              {droneCount} connected
            </Badge>
          )}
        </div>

        {/* DFU device banner */}
        {dfuDetected && (
          <div className="bg-accent-primary/10 border border-accent-primary/30 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Usb size={14} className="text-accent-primary" />
              <span className="text-xs text-text-primary">
                DFU device detected — this device is in bootloader mode (flash-only, not MAVLink).
              </span>
            </div>
            <a
              href="/config/firmware"
              className="flex items-center gap-1 text-xs text-accent-primary hover:underline shrink-0"
            >
              <Zap size={12} />
              Go to Firmware
            </a>
          </div>
        )}

        {/* Active Connections — always visible if any exist */}
        {droneCount > 0 && (
          <div className="bg-bg-secondary border border-status-success/20 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              Active Connections
            </h2>
            <ActiveConnections />
          </div>
        )}

        {/* Connection Panel — tabbed Serial / WebSocket */}
        <div className="bg-bg-secondary border border-border-default">
          <div className="flex items-center justify-between border-b border-border-default px-4">
            <Tabs tabs={CONNECTION_TABS} activeTab={tab} onChange={setTab} />
            <Button
              variant="ghost"
              size="sm"
              icon={<Save size={12} />}
              onClick={handleSavePreset}
            >
              Save Preset
            </Button>
          </div>
          <div className="p-4">
            {tab === "serial" ? (
              <SerialPanel onConnected={handleSerialConnected} />
            ) : (
              <WebSocketPanel onConnected={handleWsConnected} />
            )}
          </div>
        </div>

        {/* Bottom row: Presets + Recent side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Saved Presets */}
          <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-accent-secondary" />
              <h2 className="text-sm font-semibold text-text-primary">
                Saved Presets
              </h2>
            </div>
            <ConnectionPresets key={presetsKey} onApply={handleApplyPreset} />
          </div>

          {/* Recent Connections */}
          <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
            <div className="flex items-center gap-2">
              <History size={14} className="text-text-secondary" />
              <h2 className="text-sm font-semibold text-text-primary">
                Recent Connections
              </h2>
            </div>
            <RecentConnections />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Recent Connections (with working reconnect) ────────────

function RecentConnections() {
  const [connections, setConnections] = useState<RecentConnection[]>([]);
  const [reconnecting, setReconnecting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addDrone = useDroneManager((s) => s.addDrone);

  useEffect(() => {
    try {
      setConnections(
        JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"),
      );
    } catch {
      setConnections([]);
    }
  }, []);

  function clearHistory() {
    localStorage.removeItem(RECENT_KEY);
    setConnections([]);
  }

  async function handleReconnect(conn: RecentConnection, index: number) {
    setError(null);
    setReconnecting(index);

    try {
      if (conn.type === "websocket" && conn.url) {
        const transport = new WebSocketTransport();
        await transport.connect(conn.url);
        const adapter = new MAVLinkAdapter();
        const vehicleInfo = await adapter.connect(transport);
        const droneId = randomId();
        const droneName = `${vehicleInfo.firmwareVersionString} (${vehicleInfo.vehicleClass})`;
        addDrone(droneId, droneName, adapter, transport, vehicleInfo);
        saveRecentConnection({ ...conn, name: droneName, date: Date.now() });
      } else if (conn.type === "serial") {
        // Check if any permitted port is available
        const ports = await serialPortManager.getKnownPorts();
        if (ports.length === 0) {
          setError("No permitted serial ports. Click 'Request Port' in the Serial tab.");
          return;
        }
        // Connect to first available port
        const transport = new WebSerialTransport();
        await transport.connectToPort(ports[0].port, conn.baudRate || 115200);
        const adapter = new MAVLinkAdapter();
        const vehicleInfo = await adapter.connect(transport);
        const droneId = randomId();
        const droneName = `${vehicleInfo.firmwareVersionString} (${vehicleInfo.vehicleClass})`;
        addDrone(droneId, droneName, adapter, transport, vehicleInfo);
        saveRecentConnection({ ...conn, name: droneName, date: Date.now() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconnect failed");
    } finally {
      setReconnecting(null);
    }
  }

  function timeAgo(date: number): string {
    const diff = Date.now() - date;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  if (connections.length === 0) {
    return (
      <p className="text-[10px] text-text-tertiary py-2">
        No recent connections. Connect to a flight controller above.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {connections.map((conn, i) => (
        <div
          key={`${conn.date}-${i}`}
          className="flex items-center justify-between gap-2 py-1.5 border-b border-border-default last:border-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            {conn.type === "serial" ? (
              <Usb size={12} className="text-text-tertiary shrink-0" />
            ) : (
              <Wifi size={12} className="text-text-tertiary shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[10px] text-text-primary truncate">
                {conn.name}
              </p>
              <p className="text-[10px] text-text-tertiary font-mono">
                {conn.type === "serial"
                  ? `@ ${conn.baudRate}`
                  : conn.url?.replace("ws://", "")}
                {" · "}
                {timeAgo(conn.date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={conn.type === "serial" ? "info" : "neutral"}>
              {conn.type === "serial" ? "USB" : "WS"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCw size={10} />}
              onClick={() => handleReconnect(conn, i)}
              loading={reconnecting === i}
            >
              Reconnect
            </Button>
          </div>
        </div>
      ))}
      {error && <p className="text-[10px] text-status-error mt-1">{error}</p>}
      <div className="pt-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={10} />}
          onClick={clearHistory}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
