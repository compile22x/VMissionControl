"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

const ACCENT_COLORS = [
  { name: "Blue", value: "#3a82ff" },
  { name: "Green", value: "#22c55e" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Red", value: "#ef4444" },
  { name: "Lime", value: "#dff140" },
] as const;

export function ThemeSection() {
  const [darkMode, setDarkMode] = useState(true);
  const [selectedAccent, setSelectedAccent] = useState("#3a82ff");

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Theme</h2>

      <Card>
        <div className="space-y-4">
          <Toggle
            label="Dark mode"
            checked={darkMode}
            onChange={setDarkMode}
          />
          <p className="text-[10px] text-text-tertiary">
            Light mode coming soon
          </p>
        </div>
      </Card>

      <Card title="Accent Color">
        <div className="flex gap-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => setSelectedAccent(color.value)}
              className={cn(
                "w-8 h-8 border-2 transition-all cursor-pointer",
                selectedAccent === color.value
                  ? "border-text-primary scale-110"
                  : "border-transparent hover:border-border-default"
              )}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
        <p className="text-[10px] text-text-tertiary mt-2">
          Selected: {ACCENT_COLORS.find((c) => c.value === selectedAccent)?.name}
        </p>
      </Card>
    </div>
  );
}
