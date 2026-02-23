import { create } from "zustand";
import type { Mission, Waypoint, MissionState, SuiteType } from "@/lib/types";
import type { MissionItem } from "@/lib/protocol/types";
import { useDroneManager } from "./drone-manager";

interface MissionStoreState {
  activeMission: Mission | null;
  waypoints: Waypoint[];
  progress: number;
  currentWaypoint: number;
  uploadState: "idle" | "uploading" | "uploaded" | "error";

  setMission: (mission: Mission | null) => void;
  setWaypoints: (waypoints: Waypoint[]) => void;
  addWaypoint: (waypoint: Waypoint) => void;
  removeWaypoint: (id: string) => void;
  updateWaypoint: (id: string, update: Partial<Waypoint>) => void;
  setProgress: (progress: number, currentWaypoint: number) => void;
  setMissionState: (state: MissionState) => void;
  setUploadState: (state: "idle" | "uploading" | "uploaded" | "error") => void;
  createMission: (name: string, droneId: string, suiteType?: SuiteType) => void;
  clearMission: () => void;
  uploadMission: () => Promise<void>;
  downloadMission: () => Promise<void>;
}

export const useMissionStore = create<MissionStoreState>((set, get) => ({
  activeMission: null,
  waypoints: [],
  progress: 0,
  currentWaypoint: 0,
  uploadState: "idle",

  setMission: (activeMission) => set({
    activeMission,
    waypoints: activeMission?.waypoints ?? [],
    progress: activeMission?.progress ?? 0,
    currentWaypoint: activeMission?.currentWaypoint ?? 0,
  }),

  setWaypoints: (waypoints) => set({ waypoints }),

  addWaypoint: (waypoint) =>
    set((state) => ({ waypoints: [...state.waypoints, waypoint] })),

  removeWaypoint: (id) =>
    set((state) => ({
      waypoints: state.waypoints.filter((w) => w.id !== id),
    })),

  updateWaypoint: (id, update) =>
    set((state) => ({
      waypoints: state.waypoints.map((w) =>
        w.id === id ? { ...w, ...update } : w
      ),
    })),

  setProgress: (progress, currentWaypoint) =>
    set({ progress, currentWaypoint }),

  setMissionState: (state) =>
    set((s) =>
      s.activeMission
        ? { activeMission: { ...s.activeMission, state } }
        : {}
    ),

  setUploadState: (uploadState) => set({ uploadState }),

  createMission: (name, droneId, suiteType) =>
    set({
      activeMission: {
        id: Math.random().toString(36).substring(2, 10),
        name,
        droneId,
        suiteType,
        waypoints: [],
        state: "planning",
        progress: 0,
        currentWaypoint: 0,
      },
      waypoints: [],
      progress: 0,
      currentWaypoint: 0,
      uploadState: "idle",
    }),

  clearMission: () =>
    set({
      activeMission: null,
      waypoints: [],
      progress: 0,
      currentWaypoint: 0,
      uploadState: "idle",
    }),

  uploadMission: async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol) return;
    const { waypoints } = get();
    if (waypoints.length === 0) return;

    set({ uploadState: "uploading" });
    const items: MissionItem[] = waypoints.map((wp, i) => ({
      seq: i,
      frame: 3,     // MAV_FRAME_GLOBAL_RELATIVE_ALT
      command: wp.command === "TAKEOFF" ? 22 : wp.command === "LAND" ? 21 : wp.command === "RTL" ? 20 : wp.command === "LOITER" ? 17 : 16, // MAV_CMD_NAV_*
      current: i === 0 ? 1 : 0,
      autocontinue: 1,
      param1: wp.holdTime ?? 0,
      param2: wp.param1 ?? 0,
      param3: wp.param2 ?? 0,
      param4: wp.param3 ?? 0,
      x: Math.round(wp.lat * 1e7),
      y: Math.round(wp.lon * 1e7),
      z: wp.alt,
    }));

    try {
      const result = await protocol.uploadMission(items);
      set({ uploadState: result.success ? "uploaded" : "error" });
    } catch {
      set({ uploadState: "error" });
    }
  },

  downloadMission: async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol) return;

    try {
      const items = await protocol.downloadMission();
      const waypoints: Waypoint[] = items.map((item) => ({
        id: Math.random().toString(36).substring(2, 10),
        lat: item.x / 1e7,
        lon: item.y / 1e7,
        alt: item.z,
        holdTime: item.param1 || undefined,
        command: item.command === 22 ? "TAKEOFF" : item.command === 21 ? "LAND" : item.command === 20 ? "RTL" : item.command === 17 ? "LOITER" : "WAYPOINT",
      }));
      set({ waypoints });
    } catch {
      // downloadMission not yet implemented on protocol — silent fail
    }
  },
}));
