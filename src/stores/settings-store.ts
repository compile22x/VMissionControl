/**
 * @module settings-store
 * @description Zustand store for user preferences that persist across sessions.
 * Fully persisted to IndexedDB. These are portable settings that can optionally
 * sync to cloud when authenticated.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { indexedDBStorage } from "@/lib/storage";
import type { Jurisdiction } from "@/lib/jurisdiction";

export type MapTileSource = "osm" | "satellite" | "terrain" | "dark";
export type UnitSystem = "metric" | "imperial";
export type { Jurisdiction };

interface SettingsStoreState {
  /** Map tile source. */
  mapTileSource: MapTileSource;
  /** Unit system for display. */
  units: UnitSystem;
  /** Whether the local-data warning banner has been dismissed. */
  bannerDismissed: boolean;
  /** Timestamp when banner was dismissed (for 30-day re-show). */
  bannerDismissedAt: number | null;
  /** Total number of mission saves (for banner trigger logic). */
  saveCount: number;
  /** Whether the user has completed the welcome onboarding modal. */
  onboarded: boolean;
  /** Regulatory jurisdiction. */
  jurisdiction: Jurisdiction;
  /** Whether demo mode is active (gates mock data engine). */
  demoMode: boolean;
  /** True after IndexedDB hydration completes (prevents welcome modal flash). */
  _hasHydrated: boolean;

  setMapTileSource: (source: MapTileSource) => void;
  setUnits: (units: UnitSystem) => void;
  dismissBanner: () => void;
  incrementSaveCount: () => void;
  setOnboarded: (onboarded: boolean) => void;
  setJurisdiction: (jurisdiction: Jurisdiction) => void;
  setDemoMode: (demoMode: boolean) => void;
}

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set) => ({
      mapTileSource: "osm",
      units: "metric",
      bannerDismissed: false,
      bannerDismissedAt: null,
      saveCount: 0,
      onboarded: false,
      jurisdiction: "dgca",
      demoMode: true,
      _hasHydrated: false,

      setMapTileSource: (mapTileSource) => set({ mapTileSource }),
      setUnits: (units) => set({ units }),
      dismissBanner: () => set({ bannerDismissed: true, bannerDismissedAt: Date.now() }),
      incrementSaveCount: () => set((s) => ({ saveCount: s.saveCount + 1 })),
      setOnboarded: (onboarded) => set({ onboarded }),
      setJurisdiction: (jurisdiction) => set({ jurisdiction }),
      setDemoMode: (demoMode) => set({ demoMode }),
    }),
    {
      name: "altcmd:settings",
      storage: createJSONStorage(indexedDBStorage.storage),
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          state.onboarded = false;
          state.jurisdiction = "dgca";
          state.demoMode = true;
        }
        return state as unknown as SettingsStoreState;
      },
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state._hasHydrated = true;
          }
        };
      },
    }
  )
);
