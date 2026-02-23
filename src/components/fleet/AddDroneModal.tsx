"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface AddDroneModalProps {
  open: boolean;
  onClose: () => void;
}

const weightClassOptions = [
  { value: "nano", label: "Nano (< 250g)" },
  { value: "micro", label: "Micro (250g - 2kg)" },
  { value: "small", label: "Small (2kg - 25kg)" },
  { value: "medium", label: "Medium (25kg - 150kg)" },
  { value: "large", label: "Large (> 150kg)" },
];

const tierOptions = [
  { value: "tier1", label: "Tier 1 - MAVLink + 4G" },
  { value: "tier2", label: "Tier 2 - Onboard Compute" },
  { value: "tier3", label: "Tier 3 - ADOS Hardware" },
  { value: "tier4", label: "Tier 4 - Mesh Radio" },
];

export function AddDroneModal({ open, onClose }: AddDroneModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [serial, setSerial] = useState("");
  const [weightClass, setWeightClass] = useState("micro");
  const [tier, setTier] = useState("tier1");

  const handleSubmit = () => {
    if (!name.trim()) {
      toast("Drone name is required", "error");
      return;
    }
    toast(`Drone "${name}" added successfully`, "success");
    setName("");
    setSerial("");
    setWeightClass("micro");
    setTier("tier1");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Drone"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Add Drone
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Drone Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alpha-1"
        />
        <Input
          label="Serial Number"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="e.g. ALT-2026-001"
        />
        <Select
          label="Weight Class"
          options={weightClassOptions}
          value={weightClass}
          onChange={setWeightClass}
        />
        <Select
          label="Capability Tier"
          options={tierOptions}
          value={tier}
          onChange={setTier}
        />
      </div>
    </Modal>
  );
}
