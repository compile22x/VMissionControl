/**
 * @module AltitudeSlider
 * @description Vertical slider on the right side of the viewport.
 * Sets operational altitude for filtering which zones are shown as restricted.
 * @license GPL-3.0-only
 */

"use client";

import { useAirspaceStore } from "@/stores/airspace-store";

export function AltitudeSlider() {
  const altitude = useAirspaceStore((s) => s.operationalAltitude);
  const setAltitude = useAirspaceStore((s) => s.setOperationalAltitude);

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2">
      {/* Value label */}
      <div className="bg-bg-primary/70 backdrop-blur-md border border-border-default rounded px-2 py-1">
        <span className="text-[10px] font-mono font-bold text-text-primary">
          {altitude}m
        </span>
      </div>

      {/* Vertical slider */}
      <div className="relative h-48 w-6 flex items-center justify-center">
        <input
          type="range"
          min={0}
          max={500}
          step={10}
          value={altitude}
          onChange={(e) => setAltitude(parseInt(e.target.value, 10))}
          className="h-full w-6 appearance-none bg-transparent cursor-pointer"
          style={{
            writingMode: "vertical-lr",
            direction: "rtl",
          }}
        />
      </div>

      {/* Label */}
      <div className="bg-bg-primary/70 backdrop-blur-md border border-border-default rounded px-2 py-1">
        <span className="text-[9px] font-mono text-text-tertiary uppercase">Alt</span>
      </div>
    </div>
  );
}
