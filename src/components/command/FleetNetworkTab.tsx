"use client";

import { Network } from "lucide-react";

export function FleetNetworkTab() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3 max-w-sm">
        <Network size={32} className="text-text-tertiary mx-auto" />
        <h3 className="text-sm font-medium text-text-primary">
          Fleet Networking
        </h3>
        <p className="text-xs text-text-tertiary leading-relaxed">
          Mesh radio status, MQTT bridge configuration, and multi-drone coordination.
          Coming in Phase 1.
        </p>
      </div>
    </div>
  );
}
