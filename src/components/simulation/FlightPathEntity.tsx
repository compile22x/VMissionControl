/**
 * @module FlightPathEntity
 * @description Renders the 3D flight path with terrain-resolved altitude,
 * ground track shadow, altitude pillars at waypoints, and distance/altitude labels.
 * Falls back to clamped-to-ground path when resolved positions are unavailable.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  PolylineDashMaterialProperty,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  DistanceDisplayCondition,
  type Viewer as CesiumViewer,
  type Entity,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import { MAP_COLORS } from "@/lib/map-constants";
import { haversineDistance } from "@/lib/telemetry-utils";

interface FlightPathEntityProps {
  viewer: CesiumViewer | null;
  waypoints: Waypoint[];
  /** Terrain-resolved absolute positions (includes intermediate sub-samples). */
  resolvedPositions: Cartesian3[] | null;
  /** Indices into resolvedPositions for each original waypoint. */
  waypointIndices?: number[];
  /** Terrain height at each original waypoint (meters above ellipsoid). */
  terrainHeights?: number[];
  /** Show distance and altitude labels at waypoints. Default: true. */
  showLabels?: boolean;
}

/** Format distance as km or m depending on magnitude. */
function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function FlightPathEntity({
  viewer,
  waypoints,
  resolvedPositions,
  waypointIndices,
  terrainHeights,
  showLabels = true,
}: FlightPathEntityProps) {
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || waypoints.length < 2) return;

    const entities: Entity[] = [];
    const accentColor = Color.fromCssColorString(MAP_COLORS.accentPrimary);
    const mutedColor = Color.fromCssColorString(MAP_COLORS.muted);

    if (resolvedPositions && resolvedPositions.length >= 2) {
      // ── Elevated 3D flight path ──────────────────────────────
      const pathEntity = viewer.entities.add({
        polyline: {
          positions: resolvedPositions,
          width: 3,
          material: accentColor.withAlpha(0.9),
          clampToGround: false,
        },
      });
      entities.push(pathEntity);

      // ── Ground track (dashed shadow) ─────────────────────────
      const groundTrack = viewer.entities.add({
        polyline: {
          positions: resolvedPositions,
          width: 2,
          material: new PolylineDashMaterialProperty({
            color: mutedColor.withAlpha(0.4),
            dashLength: 12,
          }),
          clampToGround: true,
        },
      });
      entities.push(groundTrack);

      // ── Altitude pillars + labels at each original waypoint ──
      if (waypointIndices && terrainHeights) {
        let cumulativeDistance = 0;

        for (let i = 0; i < waypoints.length; i++) {
          const wp = waypoints[i];
          const posIdx = waypointIndices[i];
          if (posIdx === undefined || !resolvedPositions[posIdx]) continue;

          const topPos = resolvedPositions[posIdx];
          const groundHeight = terrainHeights[i] ?? 0;
          const groundPos = Cartesian3.fromDegrees(wp.lon, wp.lat, groundHeight);

          // Cumulative horizontal distance from start
          if (i > 0) {
            const prev = waypoints[i - 1];
            cumulativeDistance += haversineDistance(
              prev.lat, prev.lon, wp.lat, wp.lon
            );
          }

          // Altitude pillar: thin vertical line from ground to path
          const pillar = viewer.entities.add({
            polyline: {
              positions: [groundPos, topPos],
              width: 1,
              material: mutedColor.withAlpha(0.3),
              clampToGround: false,
            },
          });
          entities.push(pillar);

          // Distance + altitude label
          if (showLabels) {
            const distText = i === 0
              ? "START"
              : formatDistance(cumulativeDistance);
            const altText = `${Math.round(wp.alt)}m AGL`;

            const label = viewer.entities.add({
              position: topPos,
              label: {
                text: `${distText}\n${altText}`,
                font: "11px monospace",
                fillColor: Color.fromCssColorString(MAP_COLORS.foreground).withAlpha(0.8),
                outlineColor: Color.fromCssColorString(MAP_COLORS.background).withAlpha(0.6),
                outlineWidth: 2,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                horizontalOrigin: HorizontalOrigin.LEFT,
                pixelOffset: new Cartesian2(8, -4),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new DistanceDisplayCondition(0, 15000),
              },
            });
            entities.push(label);
          }
        }
      }
    } else {
      // ── Fallback: original clamped-to-ground path ────────────
      const positions = waypoints.map((wp) =>
        Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
      );

      const pathEntity = viewer.entities.add({
        polyline: {
          positions,
          width: 3,
          material: accentColor.withAlpha(0.9),
          clampToGround: true,
        },
      });
      entities.push(pathEntity);
    }

    return () => {
      for (const entity of entities) {
        if (!viewer.isDestroyed()) viewer.entities.remove(entity);
      }
    };
  }, [viewer, waypoints, resolvedPositions, waypointIndices, terrainHeights, showLabels]);

  return null;
}
