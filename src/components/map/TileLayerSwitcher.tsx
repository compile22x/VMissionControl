/**
 * @module TileLayerSwitcher
 * @description Replaces the static TileLayer with a switchable tile source.
 * Renders the active tile layer and a small control button to cycle between
 * CARTO Dark, OpenStreetMap, and Esri Satellite imagery. Persists selection
 * to settings-store.
 * @license GPL-3.0-only
 */

"use client";

import { useState, useCallback } from "react";
import { TileLayer } from "react-leaflet";
import { useSettingsStore, type MapTileSource } from "@/stores/settings-store";

interface TileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
}

const TILE_CONFIGS: Record<MapTileSource, TileConfig> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    maxZoom: 18,
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
};

const TILE_LABELS: Record<MapTileSource, string> = {
  dark: "DARK",
  osm: "OSM",
  satellite: "SAT",
  terrain: "TOPO",
};

const TILE_ORDER: MapTileSource[] = ["dark", "osm", "satellite", "terrain"];

export function TileLayerSwitcher() {
  const source = useSettingsStore((s) => s.mapTileSource);
  const setSource = useSettingsStore((s) => s.setMapTileSource);
  const [showPicker, setShowPicker] = useState(false);

  const config = TILE_CONFIGS[source] ?? TILE_CONFIGS.dark;

  const handleSelect = useCallback((s: MapTileSource) => {
    setSource(s);
    setShowPicker(false);
  }, [setSource]);

  return (
    <>
      <TileLayer
        key={source}
        url={config.url}
        attribution={config.attribution}
        maxZoom={config.maxZoom}
      />

      {/* Layer switcher control — top right */}
      <div className="leaflet-top leaflet-right" style={{ pointerEvents: "auto" }}>
        <div className="leaflet-control" style={{ marginTop: 10, marginRight: 10 }}>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="bg-surface-primary border border-border-default px-2 py-1 text-[9px] font-mono text-text-secondary hover:text-text-primary transition-colors"
            title="Switch map tiles"
          >
            {TILE_LABELS[source] ?? "MAP"}
          </button>
          {showPicker && (
            <div className="mt-1 bg-surface-primary border border-border-default shadow-lg">
              {TILE_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  className={`block w-full text-left px-3 py-1.5 text-[9px] font-mono transition-colors ${
                    s === source
                      ? "text-accent-primary bg-surface-secondary"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
                  }`}
                >
                  {TILE_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
