/**
 * @module GeofenceEditor
 * @description Geofence configuration panel — enable/disable toggle, type selector
 * (circle/polygon), max altitude input, and breach action dropdown.
 * @license GPL-3.0-only
 */
"use client";

import { Toggle } from "@/components/ui/toggle";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const GEOFENCE_TYPE_OPTIONS = [
  { value: "circle", label: "Circle" },
  { value: "polygon", label: "Polygon" },
];

const GEOFENCE_ACTION_OPTIONS = [
  { value: "RTL", label: "Return to Launch" },
  { value: "LAND", label: "Land" },
  { value: "REPORT", label: "Report Only" },
];

interface GeofenceEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  type: string;
  onTypeChange: (type: string) => void;
  maxAlt: string;
  onMaxAltChange: (alt: string) => void;
  action: string;
  onActionChange: (action: string) => void;
}

export function GeofenceEditor({
  enabled,
  onToggle,
  type,
  onTypeChange,
  maxAlt,
  onMaxAltChange,
  action,
  onActionChange,
}: GeofenceEditorProps) {
  return (
    <div className="flex flex-col gap-3 px-3 py-2">
      <div className="flex items-center justify-between">
        <Toggle label="Enable Geofence" checked={enabled} onChange={onToggle} />
        <Badge variant={enabled ? "success" : "neutral"} size="sm">
          {enabled ? "Active" : "Off"}
        </Badge>
      </div>

      {enabled && (
        <>
          <Select
            label="Type"
            options={GEOFENCE_TYPE_OPTIONS}
            value={type}
            onChange={onTypeChange}
          />
          <Input
            label="Max Altitude"
            type="number"
            unit="m"
            value={maxAlt}
            onChange={(e) => onMaxAltChange(e.target.value)}
            placeholder="120"
          />
          <Select
            label="Breach Action"
            options={GEOFENCE_ACTION_OPTIONS}
            value={action}
            onChange={onActionChange}
          />
        </>
      )}
    </div>
  );
}
