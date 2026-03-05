"use client";

/**
 * @module PlannedVsActualOverlay
 * @description Map overlay that renders planned mission waypoints as a blue
 * dashed polyline alongside the actual drone trail (white solid, from
 * trail-store). Designed to be placed inside a react-leaflet MapContainer.
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { Polyline, CircleMarker, Tooltip } from "react-leaflet";
import { useMissionStore } from "@/stores/mission-store";
import { useTrailStore } from "@/stores/trail-store";

export function PlannedVsActualOverlay() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const trail = useTrailStore((s) => s.trail);

  const plannedPositions = useMemo<[number, number][]>(
    () =>
      waypoints
        .filter((wp) => wp.lat !== 0 || wp.lon !== 0)
        .map((wp) => [wp.lat, wp.lon]),
    [waypoints]
  );

  const actualPositions = useMemo<[number, number][]>(
    () => trail.map((p) => [p.lat, p.lon]),
    [trail]
  );

  const hasPlanned = plannedPositions.length >= 2;
  const hasActual = actualPositions.length >= 2;

  if (!hasPlanned && !hasActual) return null;

  return (
    <>
      {/* Planned path — blue dashed */}
      {hasPlanned && (
        <>
          <Polyline
            positions={plannedPositions}
            pathOptions={{
              color: "#3A82FF",
              weight: 2,
              opacity: 0.7,
              dashArray: "8,6",
            }}
          />
          {/* Waypoint markers */}
          {plannedPositions.map((pos, i) => (
            <CircleMarker
              key={`wp-${i}`}
              center={pos}
              radius={3}
              pathOptions={{
                color: "#3A82FF",
                fillColor: "#3A82FF",
                fillOpacity: 0.8,
                weight: 1,
              }}
            >
              <Tooltip direction="top" permanent={false}>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 10,
                  }}
                >
                  WP {i + 1}
                </span>
              </Tooltip>
            </CircleMarker>
          ))}
        </>
      )}

      {/* Actual path — white solid */}
      {hasActual && (
        <Polyline
          positions={actualPositions}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            opacity: 0.85,
          }}
        />
      )}
    </>
  );
}
