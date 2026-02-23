import { create } from "zustand";
import type { HardwareComponent, HardwareConnection } from "@/lib/types";

interface HardwareStoreState {
  components: HardwareComponent[];
  connections: HardwareConnection[];
  selectedNode: string | null;

  setComponents: (components: HardwareComponent[]) => void;
  setConnections: (connections: HardwareConnection[]) => void;
  selectNode: (id: string | null) => void;
  updateComponentStatus: (id: string, status: HardwareComponent["status"]) => void;
}

export const useHardwareStore = create<HardwareStoreState>((set) => ({
  components: [],
  connections: [],
  selectedNode: null,

  setComponents: (components) => set({ components }),
  setConnections: (connections) => set({ connections }),
  selectNode: (selectedNode) => set({ selectedNode }),

  updateComponentStatus: (id, status) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
    })),
}));
