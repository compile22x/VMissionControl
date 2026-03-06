"use client";

import { Radio } from "lucide-react";

export function SensorsTab() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3 max-w-sm">
        <Radio size={32} className="text-text-tertiary mx-auto" />
        <h3 className="text-sm font-medium text-text-primary">
          Sensor Discovery
        </h3>
        <p className="text-xs text-text-tertiary leading-relaxed">
          Automatic sensor detection, configuration, and live data visualization.
          Coming in Phase 1.
        </p>
      </div>
    </div>
  );
}
