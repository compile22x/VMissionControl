"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Waypoint, WaypointCommand } from "@/lib/types";

const COMMAND_OPTIONS: { value: WaypointCommand; label: string }[] = [
  { value: "WAYPOINT", label: "Waypoint" },
  { value: "LOITER", label: "Loiter" },
  { value: "TAKEOFF", label: "Takeoff" },
  { value: "LAND", label: "Land" },
  { value: "RTL", label: "Return to Launch" },
];

interface WaypointEditorModalProps {
  open: boolean;
  onClose: () => void;
  waypoint: Waypoint | null;
  onSave: (id: string, update: Partial<Waypoint>) => void;
}

export function WaypointEditorModal({
  open,
  onClose,
  waypoint,
  onSave,
}: WaypointEditorModalProps) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [alt, setAlt] = useState("");
  const [speed, setSpeed] = useState("");
  const [command, setCommand] = useState<WaypointCommand>("WAYPOINT");
  const [holdTime, setHoldTime] = useState("");

  useEffect(() => {
    if (waypoint) {
      setLat(waypoint.lat.toFixed(6));
      setLon(waypoint.lon.toFixed(6));
      setAlt(String(waypoint.alt));
      setSpeed(waypoint.speed !== undefined ? String(waypoint.speed) : "");
      setCommand(waypoint.command ?? "WAYPOINT");
      setHoldTime(waypoint.holdTime !== undefined ? String(waypoint.holdTime) : "");
    }
  }, [waypoint]);

  const handleSave = () => {
    if (!waypoint) return;
    const update: Partial<Waypoint> = {
      lat: parseFloat(lat) || waypoint.lat,
      lon: parseFloat(lon) || waypoint.lon,
      alt: parseFloat(alt) || waypoint.alt,
      command,
    };
    if (speed) update.speed = parseFloat(speed);
    if (holdTime && command === "LOITER") update.holdTime = parseFloat(holdTime);
    onSave(waypoint.id, update);
    onClose();
  };

  if (!waypoint) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Waypoint"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Latitude"
            type="number"
            step="0.000001"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <Input
            label="Longitude"
            type="number"
            step="0.000001"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Altitude"
            type="number"
            unit="m"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
          />
          <Input
            label="Speed"
            type="number"
            unit="m/s"
            placeholder="auto"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
        </div>
        <Select
          label="Command"
          options={COMMAND_OPTIONS}
          value={command}
          onChange={(v) => setCommand(v as WaypointCommand)}
        />
        {command === "LOITER" && (
          <Input
            label="Hold Time"
            type="number"
            unit="s"
            placeholder="0"
            value={holdTime}
            onChange={(e) => setHoldTime(e.target.value)}
          />
        )}
      </div>
    </Modal>
  );
}
