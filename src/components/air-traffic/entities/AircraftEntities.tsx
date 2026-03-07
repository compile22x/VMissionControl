/**
 * @module AircraftEntities
 * @description Renders live aircraft positions using a CustomDataSource with
 * EntityCluster for automatic LOD-based clustering. Threat-level coloring,
 * heading rotation, and camera-altitude-based detail levels.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Cartesian3,
  Cartesian2,
  Cartographic,
  Color,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  Math as CesiumMath,
  CustomDataSource,
  type Viewer as CesiumViewer,
} from "cesium";
import { useTrafficStore, type DisplayMode } from "@/stores/traffic-store";
import { THREAT_COLORS, type ThreatLevel } from "@/lib/airspace/types";

interface AircraftEntitiesProps {
  viewer: CesiumViewer | null;
}

/** SVG aircraft icon (top-down silhouette) rendered as a data URI. */
function createAircraftSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M16 2 L20 14 L30 18 L20 20 L18 30 L16 24 L14 30 L12 20 L2 18 L12 14 Z" fill="${color}" stroke="#000" stroke-width="0.5"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/** Determine display mode from camera altitude in meters. */
function getDisplayMode(altitudeM: number): DisplayMode {
  if (altitudeM > 500_000) return "global";
  if (altitudeM > 50_000) return "regional";
  if (altitudeM > 5_000) return "local";
  return "close";
}

/** Clustering config per display mode. */
function getClusterConfig(mode: DisplayMode): { enabled: boolean; pixelRange: number } {
  switch (mode) {
    case "global":
      return { enabled: true, pixelRange: 80 };
    case "regional":
      return { enabled: true, pixelRange: 35 };
    case "local":
    case "close":
      return { enabled: false, pixelRange: 0 };
  }
}

export function AircraftEntities({ viewer }: AircraftEntitiesProps) {
  const aircraft = useTrafficStore((s) => s.aircraft);
  const threatLevels = useTrafficStore((s) => s.threatLevels);
  const altitudeFilter = useTrafficStore((s) => s.altitudeFilter);
  const setDisplayMode = useTrafficStore((s) => s.setDisplayMode);
  const dsRef = useRef<CustomDataSource | null>(null);
  const entityIdsRef = useRef<Set<string>>(new Set());

  // Initialize CustomDataSource with clustering
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const ds = new CustomDataSource("aircraft");
    ds.clustering.enabled = true;
    ds.clustering.pixelRange = 45;
    ds.clustering.minimumClusterSize = 3;

    // Cluster event: style cluster pins with threat-aware coloring
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ds.clustering.clusterEvent.addEventListener(
      (clusteredEntities: any[], cluster: any) => {
        // Read current threat levels from store (avoids stale closure)
        const currentThreats = useTrafficStore.getState().threatLevels;
        const entities = clusteredEntities as { id?: string }[];

        const hasRA = entities.some((e) => {
          const icao = e.id?.replace("aircraft-", "");
          return icao && currentThreats.get(icao) === "ra";
        });
        const hasTA = !hasRA && entities.some((e) => {
          const icao = e.id?.replace("aircraft-", "");
          return icao && currentThreats.get(icao) === "ta";
        });

        const color = hasRA ? Color.RED : hasTA ? Color.ORANGE : Color.fromCssColorString("#3A82FF");
        const count = entities.length;

        cluster.label.show = true;
        cluster.label.text = String(count);
        cluster.label.font = "bold 12px monospace";
        cluster.label.fillColor = Color.WHITE;
        cluster.label.outlineColor = Color.BLACK;
        cluster.label.outlineWidth = 2;
        cluster.label.style = LabelStyle.FILL_AND_OUTLINE;
        cluster.label.verticalOrigin = VerticalOrigin.CENTER;
        cluster.label.horizontalOrigin = HorizontalOrigin.CENTER;
        cluster.label.showBackground = true;
        cluster.label.backgroundColor = color.withAlpha(0.8);
        cluster.label.backgroundPadding = new Cartesian2(8, 5);

        cluster.billboard.show = false;
        cluster.point.show = false;
      },
    );

    viewer.dataSources.add(ds);
    dsRef.current = ds;

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(ds, true);
      }
      dsRef.current = null;
    };
  }, [viewer]); // threatLevels intentionally excluded - cluster event reads from ref

  // Camera move listener for LOD-based clustering
  const handleCameraMove = useCallback(() => {
    if (!viewer || viewer.isDestroyed() || !dsRef.current) return;

    const cartographic = Cartographic.fromCartesian(viewer.camera.positionWC);
    const altM = cartographic.height;
    const mode = getDisplayMode(altM);
    const config = getClusterConfig(mode);

    setDisplayMode(mode);

    const clustering = dsRef.current.clustering;
    if (clustering.enabled !== config.enabled) {
      clustering.enabled = config.enabled;
    }
    if (config.enabled && clustering.pixelRange !== config.pixelRange) {
      clustering.pixelRange = config.pixelRange;
    }
  }, [viewer, setDisplayMode]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.moveEnd.addEventListener(handleCameraMove);
    handleCameraMove(); // initial
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(handleCameraMove);
      }
    };
  }, [viewer, handleCameraMove]);

  // Update entities when aircraft data changes
  useEffect(() => {
    const ds = dsRef.current;
    if (!ds || !viewer || viewer.isDestroyed()) return;

    const displayMode = useTrafficStore.getState().displayMode;
    const showLabels = displayMode === "local" || displayMode === "close";
    const currentIds = new Set<string>();

    for (const [icao24, ac] of aircraft) {
      if (ac.altitudeMsl !== null && ac.altitudeMsl > altitudeFilter) continue;
      if (ac.lat === 0 && ac.lon === 0) continue;

      const entityId = `aircraft-${icao24}`;
      currentIds.add(entityId);

      const threat: ThreatLevel = threatLevels.get(icao24) ?? "other";
      const color = THREAT_COLORS[threat];
      const altM = ac.altitudeMsl ?? 0;
      const heading = ac.heading ?? 0;
      const callsign = ac.callsign?.trim() || icao24.toUpperCase();

      const existing = ds.entities.getById(entityId);
      if (existing) {
        existing.position = Cartesian3.fromDegrees(ac.lon, ac.lat, altM) as never;
        if (existing.billboard) {
          existing.billboard.rotation = CesiumMath.toRadians(-heading) as never;
          existing.billboard.image = createAircraftSvg(color) as never;
        }
        if (existing.label) {
          existing.label.show = showLabels as never;
        }
      } else {
        ds.entities.add({
          id: entityId,
          name: callsign,
          position: Cartesian3.fromDegrees(ac.lon, ac.lat, altM),
          billboard: {
            image: createAircraftSvg(color),
            width: 24,
            height: 24,
            rotation: CesiumMath.toRadians(-heading),
            alignedAxis: Cartesian3.UNIT_Z,
            verticalOrigin: VerticalOrigin.CENTER,
            horizontalOrigin: HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: callsign,
            font: "10px monospace",
            show: showLabels,
            fillColor: Color.fromCssColorString(color),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -16),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,
            backgroundColor: Color.fromCssColorString("#0a0a0f").withAlpha(0.7),
            backgroundPadding: new Cartesian2(4, 2),
          },
          description: `<p><b>${callsign}</b></p><p>ICAO: ${icao24}</p><p>Alt: ${altM.toFixed(0)}m MSL</p><p>Speed: ${ac.velocity?.toFixed(0) ?? "?"} m/s</p><p>Heading: ${heading.toFixed(0)}&deg;</p><p>VRate: ${ac.verticalRate?.toFixed(1) ?? "?"} m/s</p>${ac.registration ? `<p>Reg: ${ac.registration}</p>` : ""}${ac.aircraftType ? `<p>Type: ${ac.aircraftType}</p>` : ""}<p>Country: ${ac.originCountry}</p>`,
        });
      }
    }

    // Remove stale entities
    for (const id of entityIdsRef.current) {
      if (!currentIds.has(id)) {
        ds.entities.removeById(id);
      }
    }

    entityIdsRef.current = currentIds;
    viewer.scene.requestRender();
  }, [viewer, aircraft, threatLevels, altitudeFilter]);

  return null;
}
