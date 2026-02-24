/**
 * @module mission-io
 * @description Mission save/load/autosave utilities for the .altmission file format.
 *
 * File format: `.altmission` — JSON with `{ version, metadata, waypoints }`.
 * Autosave uses a 2-second debounce timer writing to `localStorage` under
 * the key `altcmd_autosave`. Call {@link cancelAutoSave} on page unmount
 * to prevent stale timer fires after navigation.
 *
 * @license GPL-3.0-only
 */

import type { Waypoint, SuiteType } from "@/lib/types";

const AUTOSAVE_KEY = "altcmd_autosave";
const RECENT_KEY = "altcmd_recent_missions";
const MAX_RECENT = 10;

export interface MissionMetadata {
  name: string;
  droneId?: string;
  suiteType?: SuiteType;
  createdAt: number;
  updatedAt: number;
}

export interface MissionFile {
  version: 1;
  metadata: MissionMetadata;
  waypoints: Waypoint[];
}

interface RecentMission {
  name: string;
  date: number;
  wpCount: number;
  key: string; // localStorage key
}

/** Save mission as downloadable .altmission JSON file. */
export function downloadMissionFile(waypoints: Waypoint[], metadata: MissionMetadata): void {
  const file: MissionFile = {
    version: 1,
    metadata: { ...metadata, updatedAt: Date.now() },
    waypoints,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${metadata.name || "mission"}.altmission`;
  a.click();
  URL.revokeObjectURL(url);
  addToRecent(metadata.name, waypoints.length);
}

/** Load mission from a File object. */
export async function loadMissionFile(file: File): Promise<MissionFile> {
  const text = await file.text();
  const data = JSON.parse(text) as MissionFile;
  if (!data.version || !data.waypoints || !Array.isArray(data.waypoints)) {
    throw new Error("Invalid .altmission file");
  }
  return data;
}

/** Debounced auto-save to localStorage (2s debounce). */
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function autoSave(waypoints: Waypoint[], metadata: Partial<MissionMetadata>): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try {
      const data: MissionFile = {
        version: 1,
        metadata: {
          name: metadata.name || "Untitled",
          droneId: metadata.droneId,
          suiteType: metadata.suiteType,
          createdAt: metadata.createdAt || Date.now(),
          updatedAt: Date.now(),
        },
        waypoints,
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable — silent fail
    }
  }, 2000);
}

/** Cancel any pending auto-save timer. Call on page unmount. */
export function cancelAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/** Get auto-saved mission data. */
export function getAutoSave(): MissionFile | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as MissionFile;
    if (!data.waypoints?.length) return null;
    return data;
  } catch {
    return null;
  }
}

/** Clear auto-save. */
export function clearAutoSave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // silent
  }
}

/** Save to localStorage with a named key + add to recents. */
export function saveMissionToStorage(waypoints: Waypoint[], metadata: MissionMetadata): void {
  const key = `altcmd_mission_${Date.now()}`;
  const file: MissionFile = {
    version: 1,
    metadata: { ...metadata, updatedAt: Date.now() },
    waypoints,
  };
  try {
    localStorage.setItem(key, JSON.stringify(file));
    addToRecent(metadata.name, waypoints.length, key);
  } catch {
    // silent
  }
}

/** Get recent missions list. */
export function getRecentMissions(): RecentMission[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentMission[];
  } catch {
    return [];
  }
}

/** Load a mission from localStorage by key. */
export function loadMissionFromStorage(key: string): MissionFile | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as MissionFile;
  } catch {
    return null;
  }
}

function addToRecent(name: string, wpCount: number, key?: string): void {
  try {
    const recent = getRecentMissions();
    recent.unshift({ name, date: Date.now(), wpCount, key: key || "" });
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // silent
  }
}
