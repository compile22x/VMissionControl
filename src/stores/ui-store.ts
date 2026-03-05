import { create } from "zustand";
import type { ViewId, PanelState } from "@/lib/types";

interface UiStoreState {
  activeView: ViewId;
  panels: PanelState;
  sidebarOpen: boolean;
  modalOpen: string | null;
  immersiveMode: boolean;
  /** Pending param search from Cmd+K — consumed by ParametersPanel to set initial filter. */
  pendingParamSearch: string | null;
  /** Pending detail tab switch from Cmd+K — consumed by DroneDetailPanel. */
  pendingDetailTab: string | null;

  setActiveView: (view: ViewId) => void;
  togglePanel: (panel: keyof PanelState) => void;
  setPanel: (panel: keyof PanelState, open: boolean) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  enterImmersiveMode: () => void;
  exitImmersiveMode: () => void;
  setPendingParamSearch: (query: string | null) => void;
  setPendingDetailTab: (tab: string | null) => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeView: "dashboard",
  panels: { telemetry: true, alerts: true, chat: false },
  sidebarOpen: true,
  modalOpen: null,
  immersiveMode: false,
  pendingParamSearch: null,
  pendingDetailTab: null,

  setActiveView: (activeView) => set({ activeView }),

  togglePanel: (panel) =>
    set((state) => ({
      panels: { ...state.panels, [panel]: !state.panels[panel] },
    })),

  setPanel: (panel, open) =>
    set((state) => ({
      panels: { ...state.panels, [panel]: open },
    })),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  openModal: (modalOpen) => set({ modalOpen }),
  closeModal: () => set({ modalOpen: null }),
  enterImmersiveMode: () => set({ immersiveMode: true }),
  exitImmersiveMode: () => set({ immersiveMode: false }),
  setPendingParamSearch: (pendingParamSearch) => set({ pendingParamSearch }),
  setPendingDetailTab: (pendingDetailTab) => set({ pendingDetailTab }),
}));
