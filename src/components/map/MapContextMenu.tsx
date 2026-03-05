/**
 * @module MapContextMenu
 * @description Right-click context menu on the fly map. Shows "Go Here" option
 * that sends DO_REPOSITION (GUIDED goto) to the drone at the clicked lat/lon.
 * Only active when a drone is connected and in a compatible mode (GUIDED, AUTO).
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useCallback, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { useDroneManager } from "@/stores/drone-manager";
import { useDroneStore } from "@/stores/drone-store";
import { useTelemetryStore } from "@/stores/telemetry-store";

const GUIDED_MODES = new Set(["GUIDED", "AUTO", "GUIDED_NOGPS", "LOITER"]);

export function MapContextMenu() {
  const map = useMap();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number; lat: number; lon: number } | null>(null);

  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connectionState = useDroneStore((s) => s.connectionState);
  const flightMode = useDroneStore((s) => s.flightMode);

  const isConnected = connectionState === "connected";
  const isCompatibleMode = GUIDED_MODES.has(flightMode);
  const canNavigate = isConnected && isCompatibleMode;

  // Close menu on map click or move
  const closeMenu = useCallback(() => setMenuPos(null), []);

  useEffect(() => {
    const onContextMenu = (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      if (!canNavigate) return;

      const containerPoint = map.latLngToContainerPoint(e.latlng);
      setMenuPos({
        x: containerPoint.x,
        y: containerPoint.y,
        lat: e.latlng.lat,
        lon: e.latlng.lng,
      });
    };

    map.on("contextmenu", onContextMenu);
    map.on("click", closeMenu);
    map.on("movestart", closeMenu);

    return () => {
      map.off("contextmenu", onContextMenu);
      map.off("click", closeMenu);
      map.off("movestart", closeMenu);
    };
  }, [map, closeMenu, canNavigate]);

  const handleGoHere = useCallback(async () => {
    if (!menuPos) return;
    const protocol = getProtocol();
    if (!protocol) return;

    // Use current altitude (relativeAlt) or default 10m
    const pos = useTelemetryStore.getState().position.latest();
    const alt = pos?.relativeAlt ?? 10;

    await protocol.guidedGoto(menuPos.lat, menuPos.lon, alt);
    setMenuPos(null);
  }, [menuPos, getProtocol]);

  if (!menuPos) return null;

  return (
    <div
      className="absolute z-[2000] bg-surface-primary border border-border-default shadow-lg"
      style={{ left: menuPos.x, top: menuPos.y, minWidth: 160 }}
    >
      <button
        onClick={handleGoHere}
        className="w-full text-left px-3 py-2 text-xs font-mono text-text-primary hover:bg-surface-secondary transition-colors flex items-center gap-2"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1L13 13H1L7 1Z" fill="#3A82FF" fillOpacity="0.6" stroke="#3A82FF" strokeWidth="1"/>
        </svg>
        Go Here (GUIDED)
      </button>
      <div className="border-t border-border-default" />
      <div className="px-3 py-1.5 text-[9px] font-mono text-text-tertiary">
        {menuPos.lat.toFixed(6)}, {menuPos.lon.toFixed(6)}
      </div>
    </div>
  );
}
