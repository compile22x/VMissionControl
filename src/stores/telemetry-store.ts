import { create } from "zustand";
import { RingBuffer } from "@/lib/ring-buffer";
import type { AttitudeData, PositionData, BatteryData, GpsData, VfrData, RcData } from "@/lib/types";

interface TelemetryStoreState {
  attitude: RingBuffer<AttitudeData>;
  position: RingBuffer<PositionData>;
  battery: RingBuffer<BatteryData>;
  gps: RingBuffer<GpsData>;
  vfr: RingBuffer<VfrData>;
  rc: RingBuffer<RcData>;

  pushAttitude: (data: AttitudeData) => void;
  pushPosition: (data: PositionData) => void;
  pushBattery: (data: BatteryData) => void;
  pushGps: (data: GpsData) => void;
  pushVfr: (data: VfrData) => void;
  pushRc: (data: RcData) => void;
  clear: () => void;
}

export const useTelemetryStore = create<TelemetryStoreState>((set, get) => ({
  attitude: new RingBuffer<AttitudeData>(600),   // 10Hz x 60s
  position: new RingBuffer<PositionData>(300),   // 5Hz x 60s
  battery: new RingBuffer<BatteryData>(120),     // 2Hz x 60s
  gps: new RingBuffer<GpsData>(300),             // 5Hz x 60s
  vfr: new RingBuffer<VfrData>(600),             // 10Hz x 60s
  rc: new RingBuffer<RcData>(600),               // 10Hz x 60s

  pushAttitude: (data) => {
    get().attitude.push(data);
    set({});  // trigger re-render
  },
  pushPosition: (data) => {
    get().position.push(data);
    set({});
  },
  pushBattery: (data) => {
    get().battery.push(data);
    set({});
  },
  pushGps: (data) => {
    get().gps.push(data);
    set({});
  },
  pushVfr: (data) => {
    get().vfr.push(data);
    set({});
  },
  pushRc: (data) => {
    get().rc.push(data);
    set({});
  },
  clear: () =>
    set({
      attitude: new RingBuffer<AttitudeData>(600),
      position: new RingBuffer<PositionData>(300),
      battery: new RingBuffer<BatteryData>(120),
      gps: new RingBuffer<GpsData>(300),
      vfr: new RingBuffer<VfrData>(600),
      rc: new RingBuffer<RcData>(600),
    }),
}));
