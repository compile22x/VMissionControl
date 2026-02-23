import { create } from "zustand";
import type { FleetDrone, Alert } from "@/lib/types";

interface FleetStoreState {
  drones: FleetDrone[];
  alerts: Alert[];
  lastUpdate: number;

  setDrones: (drones: FleetDrone[]) => void;
  updateDrone: (id: string, update: Partial<FleetDrone>) => void;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: string) => void;
  clearAlerts: () => void;
  touch: () => void;
}

export const useFleetStore = create<FleetStoreState>((set) => ({
  drones: [],
  alerts: [],
  lastUpdate: 0,

  setDrones: (drones) => set({ drones, lastUpdate: Date.now() }),

  updateDrone: (id, update) =>
    set((state) => ({
      drones: state.drones.map((d) => (d.id === id ? { ...d, ...update } : d)),
      lastUpdate: Date.now(),
    })),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 100), // keep last 100
    })),

  acknowledgeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
    })),

  clearAlerts: () => set({ alerts: [] }),

  touch: () => set({ lastUpdate: Date.now() }),
}));
