"use client";

import { BatteryBar } from "@/components/shared/battery-bar";
import { SensorHealthBar } from "@/components/shared/SensorHealthBar";
import { formatDate } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settings-store";
import { getJurisdictionConfig } from "@/lib/jurisdiction";
import type { FleetDrone } from "@/lib/types";

interface CompactInfoCardsProps {
  drone: FleetDrone;
}

function MetricCell({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-bg-tertiary/50 rounded px-2.5 py-2">
      <p className="text-sm font-mono font-semibold text-text-primary tabular-nums truncate">
        {value}
        {unit && <span className="text-[10px] text-text-tertiary ml-0.5">{unit}</span>}
      </p>
      <p className="text-[10px] text-text-tertiary mt-0.5">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border-default px-3 py-2.5">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

export function CompactInfoCards({ drone }: CompactInfoCardsProps) {
  const jurisdiction = useSettingsStore((s) => s.jurisdiction);
  const jConfig = getJurisdictionConfig(jurisdiction);

  return (
    <div className="bg-bg-secondary">
      {/* Health */}
      <Section title="Health">
        <SensorHealthBar compact />
        <div className="grid grid-cols-2 gap-2 mt-2">
          <MetricCell label="Health" value={drone.healthScore} unit="%" />
          <MetricCell label="Voltage" value={(drone.battery?.voltage ?? 0).toFixed(1)} unit="V" />
          <MetricCell label="GPS Sats" value={drone.gps?.satellites ?? 0} />
          <MetricCell label="Fix Type" value={drone.gps?.fixType && drone.gps.fixType >= 3 ? "3D" : drone.gps?.fixType === 2 ? "2D" : "No Fix"} />
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-text-tertiary mb-1">
            <span>Battery</span>
            <span className="font-mono tabular-nums">{Math.round(drone.battery?.remaining ?? 0)}%</span>
          </div>
          <BatteryBar percentage={drone.battery?.remaining ?? 0} />
        </div>
      </Section>

      {/* Vehicle */}
      <Section title="Vehicle">
        <div className="grid grid-cols-2 gap-2">
          <MetricCell label="Frame" value={drone.frameType || "copter"} />
          <MetricCell label="Firmware" value={drone.firmwareVersion || "ArduCopter"} />
          <MetricCell label="Compute" value="RPi CM4" />
          <MetricCell label="Weight" value="Micro" />
        </div>
      </Section>

      {/* Identity */}
      <Section title="Identity">
        <div className="grid grid-cols-2 gap-2">
          <MetricCell label="Name" value={drone.name} />
          <MetricCell label="ID" value={drone.id} />
          <MetricCell label="Serial" value={`ALT-${drone.id.toUpperCase()}`} />
          <MetricCell label={jConfig.registrationLabel} value={`${jConfig.name}-MICRO-001`} />
        </div>
      </Section>

      {/* Stats */}
      <Section title="Stats">
        <div className="grid grid-cols-2 gap-2">
          <MetricCell label="Flights" value="47" />
          <MetricCell label="Hours" value="23.4" unit="h" />
          <MetricCell label="Enrolled" value={formatDate(Date.now() - 30 * 24 * 60 * 60 * 1000)} />
          <MetricCell label="Last Flight" value={formatDate(drone.lastHeartbeat)} />
        </div>
      </Section>
    </div>
  );
}
