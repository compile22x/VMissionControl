import { create } from "zustand";
import { RingBuffer } from "@/lib/ring-buffer";

export interface MessageLogEntry {
  timestamp: number;
  msgId: number;
  msgName: string;
  direction: "in" | "out";
  size: number;
}

export type EventType =
  | "connect"
  | "disconnect"
  | "arm"
  | "disarm"
  | "mode_change"
  | "error"
  | "calibration"
  | "param_write"
  | "flash_commit"
  | "mission_upload"
  | "mission_download";

export interface EventTimelineEntry {
  timestamp: number;
  type: EventType;
  description: string;
}

export interface ConnectionLogEntry {
  type: "connect" | "disconnect" | "error";
  timestamp: number;
  details: string;
}

export interface CalibrationHistoryEntry {
  type: string;
  result: "success" | "failed" | "cancelled";
  timestamp: number;
}

export interface MessageRateEntry {
  msgId: number;
  msgName: string;
  timestamps: number[];
  hz: number;
}

interface DiagnosticsStoreState {
  messageLog: RingBuffer<MessageLogEntry>;
  eventTimeline: RingBuffer<EventTimelineEntry>;
  connectionLog: ConnectionLogEntry[];
  calibrationHistory: CalibrationHistoryEntry[];
  messageRates: Map<number, MessageRateEntry>;

  logMessage: (msgId: number, msgName: string, direction: "in" | "out", size: number) => void;
  logEvent: (type: EventType, description: string) => void;
  logConnection: (type: "connect" | "disconnect" | "error", details: string) => void;
  logCalibration: (type: string, result: "success" | "failed" | "cancelled") => void;
  updateRates: () => void;
  clear: () => void;
}

const RATE_WINDOW_MS = 5000;

export const useDiagnosticsStore = create<DiagnosticsStoreState>((set, get) => ({
  messageLog: new RingBuffer<MessageLogEntry>(2000),
  eventTimeline: new RingBuffer<EventTimelineEntry>(500),
  connectionLog: [],
  calibrationHistory: [],
  messageRates: new Map(),

  logMessage: (msgId, msgName, direction, size) => {
    const now = Date.now();
    get().messageLog.push({
      timestamp: now,
      msgId,
      msgName,
      direction,
      size,
    });

    // Track timestamps per message type for rate calculation
    const rates = get().messageRates;
    const entry = rates.get(msgId);
    if (entry) {
      entry.timestamps.push(now);
    } else {
      rates.set(msgId, { msgId, msgName, timestamps: [now], hz: 0 });
    }

    set({});
  },

  logEvent: (type, description) => {
    get().eventTimeline.push({
      timestamp: Date.now(),
      type,
      description,
    });
    set({});
  },

  logConnection: (type, details) => {
    const log = get().connectionLog;
    log.push({ type, timestamp: Date.now(), details });
    set({ connectionLog: [...log] });
  },

  logCalibration: (type, result) => {
    const history = get().calibrationHistory;
    history.push({ type, result, timestamp: Date.now() });
    set({ calibrationHistory: [...history] });
  },

  updateRates: () => {
    const now = Date.now();
    const cutoff = now - RATE_WINDOW_MS;
    const rates = get().messageRates;
    for (const entry of rates.values()) {
      // Trim old timestamps
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      entry.hz = entry.timestamps.length / (RATE_WINDOW_MS / 1000);
    }
    set({ messageRates: new Map(rates) });
  },

  clear: () =>
    set({
      messageLog: new RingBuffer<MessageLogEntry>(2000),
      eventTimeline: new RingBuffer<EventTimelineEntry>(500),
      connectionLog: [],
      calibrationHistory: [],
      messageRates: new Map(),
    }),
}));
