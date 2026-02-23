import { create } from "zustand";
import type { InputController } from "@/lib/types";

interface InputStoreState {
  activeController: InputController;
  axes: [number, number, number, number]; // roll, pitch, throttle, yaw
  buttons: boolean[];
  deadzone: number;
  expo: number;

  setController: (controller: InputController) => void;
  setAxes: (axes: [number, number, number, number]) => void;
  setButtons: (buttons: boolean[]) => void;
  setDeadzone: (deadzone: number) => void;
  setExpo: (expo: number) => void;
  resetInput: () => void;
}

export const useInputStore = create<InputStoreState>((set) => ({
  activeController: "none",
  axes: [0, 0, 0, 0],
  buttons: new Array(16).fill(false),
  deadzone: 0.05,
  expo: 0.3,

  setController: (activeController) => set({ activeController }),
  setAxes: (axes) => set({ axes }),
  setButtons: (buttons) => set({ buttons }),
  setDeadzone: (deadzone) => set({ deadzone }),
  setExpo: (expo) => set({ expo }),
  resetInput: () =>
    set({
      activeController: "none",
      axes: [0, 0, 0, 0],
      buttons: new Array(16).fill(false),
    }),
}));
