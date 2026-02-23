/**
 * Connection presets — localStorage-backed saved connection configs.
 */

export interface ConnectionPreset {
  id: string;
  name: string;
  type: "serial" | "websocket";
  config: {
    baudRate?: number;
    url?: string;
  };
  createdAt: number;
}

const STORAGE_KEY = "command:connection-presets";

function readPresets(): ConnectionPreset[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writePresets(presets: ConnectionPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* ignore storage errors */
  }
}

export function getPresets(): ConnectionPreset[] {
  return readPresets();
}

export function savePreset(preset: ConnectionPreset): void {
  const presets = readPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    presets[idx] = preset;
  } else {
    presets.push(preset);
  }
  writePresets(presets);
}

export function deletePreset(id: string): void {
  writePresets(readPresets().filter((p) => p.id !== id));
}
