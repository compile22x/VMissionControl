/**
 * @module mission-io
 * @description Mission save/load/autosave utilities for the .altmission file format.
 *
 * File format: `.altmission` — JSON with `{ version, metadata, waypoints }`.
 * Autosave uses a 2-second debounce timer writing to IndexedDB under
 * the key `altcmd_autosave`. Call {@link cancelAutoSave} on page unmount
 * to prevent stale timer fires after navigation.
 *
 * Data persisted via idb-keyval (IndexedDB). On first load, any existing
 * localStorage data is migrated to IndexedDB automatically.
 *
 * @license GPL-3.0-only
 */

import { get, set, del } from "idb-keyval";
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
  key: string;
}

// ── One-time localStorage → IndexedDB migration ────────────

async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  const migrated = await get("altcmd:migrated");
  if (migrated) return;

  try {
    const autosave = localStorage.getItem(AUTOSAVE_KEY);
    if (autosave) {
      await set(AUTOSAVE_KEY, JSON.parse(autosave));
      localStorage.removeItem(AUTOSAVE_KEY);
    }

    const recent = localStorage.getItem(RECENT_KEY);
    if (recent) {
      await set(RECENT_KEY, JSON.parse(recent));
      localStorage.removeItem(RECENT_KEY);
    }

    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("altcmd_mission_")) {
        keysToMigrate.push(key);
      }
    }
    for (const key of keysToMigrate) {
      const val = localStorage.getItem(key);
      if (val) {
        await set(key, JSON.parse(val));
        localStorage.removeItem(key);
      }
    }

    await set("altcmd:migrated", true);
  } catch {
    // Migration failed — not critical
  }
}

if (typeof window !== "undefined") {
  migrateFromLocalStorage();
}

// ── File download/upload (unchanged) ────────────────────────

/** Save mission as downloadable .altmission JSON file. */
export async function downloadMissionFile(waypoints: Waypoint[], metadata: MissionMetadata): Promise<void> {
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
  await addToRecent(metadata.name, waypoints.length);
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

// ── Autosave ────────────────────────────────────────────────

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function autoSave(waypoints: Waypoint[], metadata: Partial<MissionMetadata>): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
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
    set(AUTOSAVE_KEY, data).catch(() => {});
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
export async function getAutoSave(): Promise<MissionFile | null> {
  try {
    const data = await get<MissionFile>(AUTOSAVE_KEY);
    if (!data || !data.waypoints?.length) return null;
    return data;
  } catch {
    return null;
  }
}

/** Clear auto-save. */
export async function clearAutoSave(): Promise<void> {
  try {
    await del(AUTOSAVE_KEY);
  } catch {
    // silent
  }
}

// ── Named mission storage ───────────────────────────────────

/** Save to IndexedDB with a named key + add to recents. */
export async function saveMissionToStorage(waypoints: Waypoint[], metadata: MissionMetadata): Promise<void> {
  const key = `altcmd_mission_${Date.now()}`;
  const file: MissionFile = {
    version: 1,
    metadata: { ...metadata, updatedAt: Date.now() },
    waypoints,
  };
  try {
    await set(key, file);
    await addToRecent(metadata.name, waypoints.length, key);
  } catch {
    // silent
  }
}

/** Get recent missions list. */
export async function getRecentMissions(): Promise<RecentMission[]> {
  try {
    const recent = await get<RecentMission[]>(RECENT_KEY);
    return recent ?? [];
  } catch {
    return [];
  }
}

/** Load a mission from IndexedDB by key. */
export async function loadMissionFromStorage(key: string): Promise<MissionFile | null> {
  try {
    const data = await get<MissionFile>(key);
    return data ?? null;
  } catch {
    return null;
  }
}

async function addToRecent(name: string, wpCount: number, key?: string): Promise<void> {
  try {
    const recent = await getRecentMissions();
    recent.unshift({ name, date: Date.now(), wpCount, key: key || "" });
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    await set(RECENT_KEY, recent);
  } catch {
    // silent
  }
}
