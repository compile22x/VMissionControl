"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

export function GeneralSection() {
  const [units, setUnits] = useState("metric");
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("IST");
  const [autoConnect, setAutoConnect] = useState(true);
  const [telemetryRate, setTelemetryRate] = useState("10");

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">General Settings</h2>

      <Card>
        <div className="space-y-4">
          <Select
            label="Units"
            value={units}
            onChange={setUnits}
            options={[
              { value: "metric", label: "Metric (m, km/h, \u00b0C)" },
              { value: "imperial", label: "Imperial (ft, mph, \u00b0F)" },
            ]}
          />

          <Select
            label="Language"
            value={language}
            onChange={setLanguage}
            options={[
              { value: "en", label: "English" },
              { value: "hi", label: "Hindi" },
            ]}
          />

          <Select
            label="Timezone"
            value={timezone}
            onChange={setTimezone}
            options={[
              { value: "IST", label: "IST (UTC+5:30)" },
              { value: "UTC", label: "UTC (UTC+0:00)" },
              { value: "PST", label: "PST (UTC-8:00)" },
            ]}
          />

          <Toggle
            label="Auto-connect on startup"
            checked={autoConnect}
            onChange={setAutoConnect}
          />

          <Select
            label="Telemetry rate"
            value={telemetryRate}
            onChange={setTelemetryRate}
            options={[
              { value: "1", label: "1 Hz" },
              { value: "5", label: "5 Hz" },
              { value: "10", label: "10 Hz" },
              { value: "20", label: "20 Hz" },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
