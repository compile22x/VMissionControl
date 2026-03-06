"use client";

import {
  Cpu,
  Clock,
  Wifi,
  WifiOff,
  Shield,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import type { AgentStatus } from "@/lib/agent/types";

interface AgentStatusCardProps {
  status: AgentStatus;
}

export function AgentStatusCard({ status }: AgentStatusCardProps) {
  return (
    <div className="border border-border-default rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-primary">Agent Status</h3>
        <span className="text-xs font-mono text-text-tertiary">
          {status.device_id}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoRow icon={Cpu} label="Board" value={status.board} />
        <InfoRow icon={Shield} label="Tier" value={String(status.tier)} />
        <InfoRow
          icon={Clock}
          label="Uptime"
          value={formatDuration(status.uptime_seconds)}
        />
        <InfoRow label="OS" value={status.os} />
        <InfoRow label="Version" value={`v${status.version}`} />
        <InfoRow label="Mode" value={status.mode} />
      </div>

      <div className="flex items-center gap-4 pt-2 border-t border-border-default">
        <div className="flex items-center gap-1.5">
          {status.fc_connected ? (
            <Wifi size={12} className="text-status-success" />
          ) : (
            <WifiOff size={12} className="text-status-error" />
          )}
          <span
            className={cn(
              "text-xs",
              status.fc_connected ? "text-status-success" : "text-status-error"
            )}
          >
            FC {status.fc_connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {status.fc_connected && (
          <>
            <span className="text-xs text-text-tertiary">
              {status.fc_port} @ {status.fc_baud}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  status.armed ? "bg-status-error" : "bg-status-success"
                )}
              />
              <span className="text-xs text-text-secondary">
                {status.armed ? "ARMED" : "Disarmed"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin size={11} className="text-text-tertiary" />
              <span className="text-xs text-text-secondary font-mono">
                GPS {status.gps_fix}D / {status.satellites} sats
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Cpu;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={12} className="text-text-tertiary" />}
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="text-xs text-text-primary font-mono ml-auto">
        {value}
      </span>
    </div>
  );
}
