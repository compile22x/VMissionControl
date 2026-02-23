"use client";

import { useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { Waypoint } from "@/lib/types";
import L from "leaflet";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';
const BANGALORE_CENTER: [number, number] = [12.9716, 77.5946];

function makeWaypointIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="#3a82ff" stroke="#fafafa" stroke-width="1.5"/>
      <text x="12" y="16" text-anchor="middle" fill="#fff" font-size="11" font-family="JetBrains Mono, monospace" font-weight="600">${index + 1}</text>
    </svg>`,
  });
}


interface PlannerMapProps {
  waypoints: Waypoint[];
  onMapClick: (lat: number, lon: number) => void;
  onWaypointClick?: (id: string) => void;
  selectedWaypointId?: string | null;
}

export function PlannerMap({
  waypoints,
  onMapClick,
  onWaypointClick,
  selectedWaypointId,
}: PlannerMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  const handleMapReady = useCallback(() => {
    // Map ready callback
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onMapClick]);

  const polylinePositions: [number, number][] = waypoints.map((wp) => [wp.lat, wp.lon]);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={BANGALORE_CENTER}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "#0a0a0a" }}
        ref={(instance) => {
          if (instance) {
            mapRef.current = instance;
            handleMapReady();
          }
        }}
      >
        <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />

        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "#3a82ff",
              weight: 2,
              dashArray: "6 4",
              opacity: 0.8,
            }}
          />
        )}

        {waypoints.map((wp, i) => (
          <Marker
            key={wp.id}
            position={[wp.lat, wp.lon]}
            icon={makeWaypointIcon(i)}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                onWaypointClick?.(wp.id);
              },
            }}
          />
        ))}
      </MapContainer>

      {/* Overlay instructions */}
      {waypoints.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-bg-secondary/90 border border-border-default px-3 py-1.5">
            <span className="text-xs text-text-secondary font-mono">
              Click on map to add waypoints
            </span>
          </div>
        </div>
      )}

      {/* Waypoint count */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <div className="bg-bg-secondary/90 border border-border-default px-2 py-1">
          <span className="text-[10px] text-text-secondary font-mono">
            WP: {waypoints.length}
          </span>
        </div>
      </div>
    </div>
  );
}
