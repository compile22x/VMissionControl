"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { FleetDrone, DroneStatus, SuiteType } from "@/lib/types";

interface DroneSettingsTabProps {
  drone: FleetDrone;
}

const statusOptions: { value: DroneStatus; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "idle", label: "Idle" },
  { value: "maintenance", label: "Maintenance" },
  { value: "offline", label: "Offline" },
];

const suiteOptions: { value: string; label: string }[] = [
  { value: "none", label: "No Suite" },
  { value: "sentry", label: "Sentry" },
  { value: "survey", label: "Survey" },
  { value: "agriculture", label: "Agriculture" },
  { value: "cargo", label: "Cargo" },
  { value: "sar", label: "SAR" },
  { value: "inspection", label: "Inspection" },
];

export function DroneSettingsTab({ drone }: DroneSettingsTabProps) {
  const { toast } = useToast();
  const [name, setName] = useState(drone.name);
  const [status, setStatus] = useState<DroneStatus>(drone.status);
  const [suite, setSuite] = useState<string>(drone.suiteType || "none");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSave = () => {
    toast("Settings saved successfully", "success");
  };

  const handleDelete = () => {
    setDeleteOpen(false);
    toast(`Drone "${drone.name}" deleted`, "warning");
  };

  return (
    <div className="flex-1 overflow-auto p-3">
    <div className="max-w-lg">
      <Card title="Drone Settings">
        <div className="flex flex-col gap-4">
          <Input
            label="Drone Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            label="Status"
            options={statusOptions}
            value={status}
            onChange={(v) => setStatus(v as DroneStatus)}
          />
          <Select
            label="Suite"
            options={suiteOptions}
            value={suite}
            onChange={(v) => setSuite(v as SuiteType | "none")}
          />
          <div className="flex items-center justify-between pt-2 border-t border-border-default">
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete Drone
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        title="Delete Drone"
        message={`Are you sure you want to delete "${drone.name}"? This action cannot be undone. All flight records and configuration will be permanently removed.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
    </div>
  );
}
