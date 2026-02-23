"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

export function NotificationsSection() {
  const [batteryWarning, setBatteryWarning] = useState("30");
  const [batteryCritical, setBatteryCritical] = useState("20");
  const [geofence, setGeofence] = useState(true);
  const [motorAnomaly, setMotorAnomaly] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [popupDuration, setPopupDuration] = useState("5");

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">Notifications</h2>

      <Card title="Battery Alerts">
        <div className="space-y-4">
          <Input
            label="Warning threshold"
            type="number"
            min={10}
            max={50}
            value={batteryWarning}
            onChange={(e) => setBatteryWarning(e.target.value)}
            unit="%"
          />
          <Input
            label="Critical threshold"
            type="number"
            min={5}
            max={30}
            value={batteryCritical}
            onChange={(e) => setBatteryCritical(e.target.value)}
            unit="%"
          />
        </div>
      </Card>

      <Card title="Alert Types">
        <div className="space-y-3">
          <Toggle
            label="Geofence alerts"
            checked={geofence}
            onChange={setGeofence}
          />
          <Toggle
            label="Motor anomaly alerts"
            checked={motorAnomaly}
            onChange={setMotorAnomaly}
          />
          <Toggle
            label="Sound effects"
            checked={soundEffects}
            onChange={setSoundEffects}
          />
        </div>
      </Card>

      <Card>
        <Select
          label="Alert popup duration"
          value={popupDuration}
          onChange={setPopupDuration}
          options={[
            { value: "3", label: "3 seconds" },
            { value: "5", label: "5 seconds" },
            { value: "10", label: "10 seconds" },
            { value: "never", label: "Never dismiss" },
          ]}
        />
      </Card>
    </div>
  );
}
