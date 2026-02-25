/**
 * @module DroneEntity
 * @description Renders the animated drone arrow billboard in the 3D scene.
 * Position updates driven by the simulation store's elapsed time.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  Math as CesiumMath,
  type Viewer as CesiumViewer,
  type Entity,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import type { FlightSegment } from "@/lib/simulation-utils";
import { interpolatePosition } from "@/lib/simulation-utils";
import { useSimulationStore } from "@/stores/simulation-store";

interface DroneEntityProps {
  viewer: CesiumViewer | null;
  waypoints: Waypoint[];
  segments: FlightSegment[];
}

const DRONE_ENTITY_ID = "sim-drone";

const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
  <polygon points="12,2 20,20 12,16 4,20" fill="#dff140" stroke="#fff" stroke-width="1" opacity="0.95"/>
</svg>`;
const ARROW_DATA_URL = `data:image/svg+xml;base64,${typeof window !== "undefined" ? btoa(ARROW_SVG) : ""}`;

export function DroneEntity({ viewer, waypoints, segments }: DroneEntityProps) {
  const elapsed = useSimulationStore((s) => s.elapsed);
  const droneRef = useRef<Entity | null>(null);

  // Create drone entity
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || waypoints.length === 0) return;

    const startPos = Cartesian3.fromDegrees(waypoints[0].lon, waypoints[0].lat, waypoints[0].alt);

    const drone = viewer.entities.add({
      id: DRONE_ENTITY_ID,
      position: startPos,
      billboard: {
        image: ARROW_DATA_URL,
        width: 28,
        height: 28,
        rotation: 0,
        alignedAxis: Cartesian3.UNIT_Z,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    droneRef.current = drone;

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.entities.removeById(DRONE_ENTITY_ID);
      }
      droneRef.current = null;
    };
  }, [viewer, waypoints]);

  // Update drone position on elapsed change
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !droneRef.current || segments.length === 0) return;

    const pos = interpolatePosition(segments, waypoints, elapsed);
    const cartesian = Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt);

    // Use ConstantPositionProperty for type-safe entity position update
    (droneRef.current.position as ConstantPositionProperty).setValue(cartesian);

    // Rotate billboard to match heading
    if (droneRef.current.billboard) {
      droneRef.current.billboard.rotation = new ConstantProperty(
        -CesiumMath.toRadians(pos.heading)
      );
    }
  }, [viewer, elapsed, segments, waypoints]);

  return null;
}
