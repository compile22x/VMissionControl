"use client";

import { Card } from "@/components/ui/card";
import { DataValue } from "@/components/ui/data-value";
import { BatteryBar } from "@/components/shared/battery-bar";
import { formatDate } from "@/lib/utils";
import type { FleetDrone } from "@/lib/types";

interface DroneOverviewTabProps {
  drone: FleetDrone;
}

export function DroneOverviewTab({ drone }: DroneOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
      <Card title="Identification">
        <div className="grid grid-cols-2 gap-4">
          <DataValue label="Name" value={drone.name} />
          <DataValue label="ID" value={drone.id} />
          <DataValue label="Serial" value={`ALT-${drone.id.toUpperCase()}`} />
          <DataValue label="Registration" value="DGCA-MICRO-001" />
        </div>
      </Card>

      <Card title="Enrollment">
        <div className="grid grid-cols-2 gap-4">
          <DataValue label="Enrolled" value={formatDate(Date.now() - 30 * 24 * 60 * 60 * 1000)} />
          <DataValue label="Last Flight" value={formatDate(drone.lastHeartbeat)} />
          <DataValue label="Total Flights" value="47" />
          <DataValue label="Flight Hours" value="23.4" unit="hrs" />
        </div>
      </Card>

      <Card title="Hardware Profile">
        <div className="grid grid-cols-2 gap-4">
          <DataValue label="Frame Type" value={drone.frameType || "Chimera7 Pro V2"} />
          <DataValue label="Firmware" value={drone.firmwareVersion || "ArduPilot 4.5"} />
          <DataValue label="Compute" value="RPi CM4" />
          <DataValue label="Weight Class" value="Micro" />
        </div>
      </Card>

      <Card title="Health & Status">
        <div className="flex flex-col gap-3">
          <DataValue label="Health Score" value={drone.healthScore} unit="%" />
          <div>
            <span className="text-[11px] text-text-secondary">Battery</span>
            <BatteryBar percentage={drone.battery?.remaining ?? 0} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DataValue
              label="Voltage"
              value={(drone.battery?.voltage ?? 0).toFixed(1)}
              unit="V"
            />
            <DataValue
              label="GPS Sats"
              value={drone.gps?.satellites ?? 0}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
