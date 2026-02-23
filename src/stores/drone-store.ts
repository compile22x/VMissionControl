import { create } from "zustand";
import type { ConnectionState, FlightMode, ArmState } from "@/lib/types";

interface DroneStoreState {
  selectedId: string | null;
  connectionState: ConnectionState;
  flightMode: FlightMode;
  armState: ArmState;
  lastHeartbeat: number;
  firmwareVersion: string;
  frameType: string;

  selectDrone: (id: string | null) => void;
  setConnectionState: (state: ConnectionState) => void;
  setFlightMode: (mode: FlightMode) => void;
  setArmState: (state: ArmState) => void;
  heartbeat: () => void;
  setFirmwareInfo: (version: string, frame: string) => void;
}

export const useDroneStore = create<DroneStoreState>((set) => ({
  selectedId: null,
  connectionState: "disconnected",
  flightMode: "STABILIZE",
  armState: "disarmed",
  lastHeartbeat: 0,
  firmwareVersion: "",
  frameType: "",

  selectDrone: (id) => set({ selectedId: id }),
  setConnectionState: (connectionState) => set({ connectionState }),
  setFlightMode: (flightMode) => set({ flightMode }),
  setArmState: (armState) => set({ armState }),
  heartbeat: () => set({ lastHeartbeat: Date.now() }),
  setFirmwareInfo: (firmwareVersion, frameType) => set({ firmwareVersion, frameType }),
}));
