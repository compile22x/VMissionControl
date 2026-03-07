/**
 * @module DronePositionEntity
 * @description Shows the connected drone's current position on the CesiumJS globe
 * as a blue pulsing billboard. Reads from the telemetry store.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useAirspaceStore } from "@/stores/airspace-store";

interface DronePositionEntityProps {
  viewer: CesiumViewer | null;
}

const ENTITY_ID = "own-drone-position";

function createDroneSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="8" fill="#3A82FF" fill-opacity="0.4" stroke="#3A82FF" stroke-width="2"/>
    <circle cx="10" cy="10" r="3" fill="#3A82FF"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function DronePositionEntity({ viewer }: DronePositionEntityProps) {
  const position = useTelemetryStore((s) => s.position);
  const layerVisibility = useAirspaceStore((s) => s.layerVisibility);
  const entityRef = useRef<any>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!layerVisibility.ownDrone) {
      if (entityRef.current) {
        viewer.entities.removeById(ENTITY_ID);
        entityRef.current = null;
        viewer.scene.requestRender();
      }
      return;
    }

    const latest = position.latest();
    if (!latest || (latest.lat === 0 && latest.lon === 0)) {
      if (entityRef.current) {
        viewer.entities.removeById(ENTITY_ID);
        entityRef.current = null;
        viewer.scene.requestRender();
      }
      return;
    }

    const Cesium = require("cesium");
    const pos = Cesium.Cartesian3.fromDegrees(
      latest.lon,
      latest.lat,
      latest.relativeAlt ?? latest.alt ?? 0
    );

    const existing = viewer.entities.getById(ENTITY_ID);
    if (existing) {
      existing.position = pos;
    } else {
      entityRef.current = viewer.entities.add({
        id: ENTITY_ID,
        name: "Own Drone",
        position: pos,
        billboard: {
          image: createDroneSvg(),
          width: 20,
          height: 20,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: "DRONE",
          font: "10px monospace",
          fillColor: Cesium.Color.fromCssColorString("#3A82FF"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#0a0a0f").withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(4, 2),
        },
      });
    }

    viewer.scene.requestRender();
  }, [viewer, position, layerVisibility.ownDrone]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.entities.removeById(ENTITY_ID);
      }
    };
  }, [viewer]);

  return null;
}
