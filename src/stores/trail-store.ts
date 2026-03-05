/**
 * @module trail-store
 * @description Zustand store that accumulates drone position history as a
 * lat/lon trail for rendering as a Leaflet polyline on the fly map.
 * Points are de-duplicated (~1m threshold) and capped at maxPoints.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export interface TrailPoint {
  lat: number;
  lon: number;
  alt: number;
}

interface TrailStoreState {
  trail: TrailPoint[];
  maxPoints: number;
  pushPoint: (lat: number, lon: number, alt?: number) => void;
  clear: () => void;
}

export const useTrailStore = create<TrailStoreState>((set, get) => ({
  trail: [],
  maxPoints: 1000,

  pushPoint: (lat, lon, alt = 0) => {
    // Reject invalid (0,0) positions — GPS not yet fixed
    if (Math.abs(lat) < 0.001 && Math.abs(lon) < 0.001) return;
    const { trail, maxPoints } = get();
    // Skip if position hasn't changed significantly (< ~1m)
    if (trail.length > 0) {
      const last = trail[trail.length - 1];
      const dlat = Math.abs(lat - last.lat);
      const dlon = Math.abs(lon - last.lon);
      if (dlat < 0.00001 && dlon < 0.00001) return;
    }
    const newTrail = [...trail, { lat, lon, alt }];
    if (newTrail.length > maxPoints) {
      newTrail.splice(0, newTrail.length - maxPoints);
    }
    set({ trail: newTrail });
  },

  clear: () => set({ trail: [] }),
}));
