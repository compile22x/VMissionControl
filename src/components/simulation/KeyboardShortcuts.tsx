/**
 * @module KeyboardShortcuts
 * @description Collapsible keyboard shortcuts reference for the Simulate tab.
 * Lists all available hotkeys for playback, camera, and speed controls.
 * @license GPL-3.0-only
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Keyboard } from "lucide-react";

const SHORTCUTS = [
  { key: "Space", action: "Play / Pause" },
  { key: "Esc", action: "Stop" },
  { key: "\u2192", action: "Step forward 1s" },
  { key: "\u2190", action: "Step back 1s" },
  { key: "T", action: "Top-down camera" },
  { key: "F", action: "Follow camera" },
  { key: "O", action: "Orbit camera" },
  { key: "X", action: "Free camera" },
  { key: "1-4", action: "Speed presets" },
  { key: "+", action: "Increase speed" },
  { key: "-", action: "Decrease speed" },
  { key: "R", action: "Reset simulation" },
];

export function KeyboardShortcuts() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-[10px] font-mono text-text-tertiary uppercase tracking-wider hover:text-text-secondary cursor-pointer"
      >
        <Keyboard size={12} />
        Keyboard Shortcuts
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <kbd className="inline-block min-w-[28px] text-center px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px] font-mono text-text-secondary">
                {s.key}
              </kbd>
              <span className="text-xs text-text-tertiary">{s.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
