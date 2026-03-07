/**
 * @module AirTrafficViewer
 * @description Composition root for the Air Traffic 3D view.
 * Renders CesiumJS globe with airspace zones, live aircraft, drone position,
 * and all control panels/overlays. Manages traffic polling lifecycle and
 * flyability assessment on globe click.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import type { Viewer as CesiumViewer } from "cesium";
import dynamic from "next/dynamic";
import { useAirspaceStore } from "@/stores/airspace-store";
import { useTrafficStore } from "@/stores/traffic-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { communityApi } from "@/lib/community-api";
import { fetchAircraft } from "@/lib/airspace/adsb-provider";
import { loadAirspaceZones } from "@/lib/airspace/airspace-provider";
import { computeAllThreats } from "@/lib/airspace/threat-calculator";
import { assessFlyability } from "@/lib/airspace/flyability";
import type { AircraftState, ThreatLevel } from "@/lib/airspace/types";

import { AirspaceVolumeEntities } from "./entities/AirspaceVolumeEntities";
import { AircraftEntities } from "./entities/AircraftEntities";
import { DronePositionEntity } from "./entities/DronePositionEntity";
import { NotamEntities } from "./entities/NotamEntities";
import { ZoneBoundaryEntities } from "./entities/ZoneBoundaryEntities";
import { LayerControlPanel } from "./panels/LayerControlPanel";
import { AirspaceInfoPanel } from "./panels/AirspaceInfoPanel";
import { AlertsPanel } from "./panels/AlertsPanel";
import { LocationSearchPanel } from "./panels/LocationSearchPanel";
import { FlyabilityOverlay } from "./overlays/FlyabilityOverlay";
import { AltitudeSlider } from "./overlays/AltitudeSlider";
import { TimelineScrubber } from "./overlays/TimelineScrubber";
import { AirTrafficMapControls } from "./controls/AirTrafficMapControls";
import { AirTrafficToolbar } from "./controls/AirTrafficToolbar";

const CesiumScene = dynamic(
  () => import("@/components/simulation/CesiumScene"),
  { ssr: false }
);

/** Fetches Cesium Ion token from Convex. */
function ConvexCesiumToken({ onToken }: { onToken: (token: string | null) => void }) {
  const config = useQuery(communityApi.clientConfig.get, {});
  useEffect(() => {
    if (config !== undefined) {
      onToken((config as { cesiumIonToken?: string } | null)?.cesiumIonToken ?? null);
    }
  }, [config, onToken]);
  return null;
}

interface AirTrafficViewerProps {
  showTrafficPanel: boolean;
  onTrafficPanelClose: () => void;
}

export function AirTrafficViewer({ showTrafficPanel, onTrafficPanelClose }: AirTrafficViewerProps) {
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const convexAvailable = useConvexAvailable();
  const [cesiumToken, setCesiumToken] = useState<string | undefined>(undefined);
  const handleCesiumToken = useCallback((t: string | null) => {
    setCesiumToken(t ?? undefined);
  }, []);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Settings
  const cesiumImageryMode = useSettingsStore((s) => s.cesiumImageryMode);
  const cesiumBuildingsEnabled = useSettingsStore((s) => s.cesiumBuildingsEnabled);
  const terrainExaggeration = useSettingsStore((s) => s.terrainExaggeration);
  const jurisdiction = useSettingsStore((s) => s.jurisdiction);

  // Store actions
  const setZones = useAirspaceStore((s) => s.setZones);
  const setLoading = useAirspaceStore((s) => s.setLoading);
  const setError = useAirspaceStore((s) => s.setError);
  const setSelectedPoint = useAirspaceStore((s) => s.setSelectedPoint);
  const setFlyability = useAirspaceStore((s) => s.setFlyability);
  const updateAircraft = useTrafficStore((s) => s.updateAircraft);
  const setThreatLevels = useTrafficStore((s) => s.setThreatLevels);
  const setPolling = useTrafficStore((s) => s.setPolling);

  const handleViewerReady = useCallback((v: CesiumViewer) => setViewer(v), []);

  // ── Load airspace zones when jurisdiction changes ──
  useEffect(() => {
    if (!jurisdiction) return;

    setLoading(true);
    setError(null);

    // Use a large default bbox (will be refined when camera moves)
    const bbox = { south: -60, north: 70, west: -180, east: 180 };

    loadAirspaceZones(jurisdiction, bbox)
      .then((zones) => {
        setZones(zones);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load airspace data");
        setLoading(false);
      });
  }, [jurisdiction, setZones, setLoading, setError]);

  // ── Traffic polling ──
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const pollInterval = useTrafficStore.getState().pollInterval;
    setPolling(true);

    async function poll() {
      // Get camera center for query position
      const Cesium = require("cesium");
      const camera = viewer!.camera;
      const cartographic = Cesium.Cartographic.fromCartesian(camera.positionWC);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);

      try {
        const result = await fetchAircraft(lat, lon, 50);
        updateAircraft(result.aircraft);

        // Compute threats relative to drone position (if connected) or camera
        const telPos = useTelemetryStore.getState().position.latest();
        const refLat = telPos?.lat ?? lat;
        const refLon = telPos?.lon ?? lon;
        const refAlt = telPos?.alt ?? 0;

        const threats = computeAllThreats(refLat, refLon, refAlt, result.aircraft);
        const threatMap = new Map<string, ThreatLevel>();
        for (const t of threats) {
          threatMap.set(t.icao24, t.level);
        }
        setThreatLevels(threatMap);
      } catch {
        // Silently ignore poll failures
      }
    }

    // Initial poll
    poll();

    // Set interval
    pollRef.current = setInterval(poll, pollInterval);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setPolling(false);
    };
  }, [viewer, updateAircraft, setThreatLevels, setPolling]);

  // ── Globe click handler for flyability assessment ──
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const Cesium = require("cesium");
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler.setInputAction((click: any) => {
      // Don't handle if clicked on an entity
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id) return;

      // Get lat/lon from click position
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);

      setSelectedPoint({ lat, lon });

      // Assess flyability
      const state = useAirspaceStore.getState();
      const trafficState = useTrafficStore.getState();
      const result = assessFlyability(
        lat,
        lon,
        state.zones,
        state.notams,
        state.tfrs,
        Array.from(trafficState.aircraft.values()),
        jurisdiction
      );
      setFlyability(result);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
    };
  }, [viewer, jurisdiction, setSelectedPoint, setFlyability]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      useAirspaceStore.getState().clear();
      useTrafficStore.getState().clear();
    };
  }, []);

  return (
    <div className="flex-1 relative min-w-0 h-full">
      {convexAvailable && <ConvexCesiumToken onToken={handleCesiumToken} />}
      <CesiumScene
        cesiumToken={cesiumToken}
        onReady={handleViewerReady}
        onError={(e) => setViewerError(e.message)}
        imageryMode={cesiumImageryMode}
        buildingsEnabled={cesiumBuildingsEnabled}
        terrainExaggeration={terrainExaggeration}
      />

      {/* Entity layers */}
      <AirspaceVolumeEntities viewer={viewer} />
      <AircraftEntities viewer={viewer} />
      <DronePositionEntity viewer={viewer} />
      <NotamEntities viewer={viewer} />
      <ZoneBoundaryEntities viewer={viewer} />

      {/* Overlays */}
      <FlyabilityOverlay />
      <AltitudeSlider />
      <TimelineScrubber />

      {/* Panels */}
      <LayerControlPanel />
      <AirspaceInfoPanel />
      <AlertsPanel />
      <LocationSearchPanel viewer={viewer} />

      {/* Controls */}
      <AirTrafficMapControls hasIonToken={!!cesiumToken} />
      <AirTrafficToolbar viewer={viewer} />

      {/* Loading state */}
      {!viewer && !viewerError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">Initializing 3D view...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {viewerError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-bg-primary/80 backdrop-blur-md rounded-lg px-6 py-4 border border-red-500/30 text-center max-w-sm">
            <p className="text-sm text-red-400">3D view failed: {viewerError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
