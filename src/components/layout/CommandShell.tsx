"use client";

import { Settings, AlertTriangle } from "lucide-react";
import { CommandNav } from "./CommandNav";
import { DemoProvider } from "./DemoProvider";
import { CommandPalette } from "@/components/shared/command-palette";
import { isDemoMode } from "@/lib/utils";
import { useFleetStore } from "@/stores/fleet-store";
import { useDroneStore } from "@/stores/drone-store";
import { useVideoStore } from "@/stores/video-store";
import { useDroneManager } from "@/stores/drone-manager";
import Link from "next/link";

export function CommandShell({ children }: { children: React.ReactNode }) {
  const demo = isDemoMode();
  const alertCount = useFleetStore((s) => s.alerts.filter((a) => !a.acknowledged).length);
  const mavConnected = useDroneManager((s) => s.selectedDroneId !== null);
  const videoStreaming = useVideoStore((s) => s.isStreaming);

  return (
    <div className="flex flex-col h-dvh">
      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-4 bg-bg-secondary border-b border-border-default shrink-0">
        {/* Left — Wordmark */}
        <div className="flex items-center gap-2">
          <span className="font-display uppercase tracking-widest text-sm font-semibold text-accent-primary">
            Altnautica Command
          </span>
          {demo && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-status-warning/20 text-status-warning">
              Demo
            </span>
          )}
        </div>

        {/* Center — Navigation */}
        <CommandNav />

        {/* Right — Status indicators */}
        <div className="flex items-center gap-3">
          {/* Connection dots: MAVLink / Video / MQTT */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${mavConnected ? "bg-status-success" : "bg-text-tertiary"}`} title="MAVLink" />
            <span className={`w-2 h-2 rounded-full ${videoStreaming ? "bg-status-success" : "bg-text-tertiary"}`} title="Video" />
            <span className="w-2 h-2 rounded-full bg-text-tertiary" title="MQTT" />
          </div>

          {/* Alert count */}
          {alertCount > 0 && (
            <div className="flex items-center gap-1 text-status-warning">
              <AlertTriangle size={12} />
              <span className="text-xs font-mono tabular-nums">{alertCount}</span>
            </div>
          )}

          {/* Cmd+K hint */}
          <kbd className="text-[10px] text-text-tertiary border border-border-default px-1 py-0.5 font-mono hidden sm:inline">
            ⌘K
          </kbd>

          {/* Settings */}
          <Link
            href="/config"
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Settings"
          >
            <Settings size={16} />
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <DemoProvider />
        <CommandPalette />
        {children}
      </main>
    </div>
  );
}
