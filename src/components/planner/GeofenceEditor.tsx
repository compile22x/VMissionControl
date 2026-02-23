"use client";

import { Toggle } from "@/components/ui/toggle";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
    <Card title="Geofence" padding={true}>
      <div className="flex flex-col gap-3">
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
    </Card>
  );
}
