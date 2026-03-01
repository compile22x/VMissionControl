"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { communityApi } from "@/lib/community-api";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Select } from "@/components/ui/select";
import type { ItemStatus, ItemPriority } from "@/lib/community-types";

const statuses: { value: ItemStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "in_discussion", label: "In Discussion" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "released", label: "Released" },
  { value: "wont_do", label: "Won't Do" },
];

const priorities: { value: ItemPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

interface AdminItemControlsProps {
  itemId: string;
  currentStatus: ItemStatus;
  currentPriority?: ItemPriority;
  currentEta?: string;
  currentResolvedVersion?: string;
}

export function AdminItemControls({
  itemId,
  currentStatus,
  currentPriority,
  currentEta,
  currentResolvedVersion,
}: AdminItemControlsProps) {
  const isAdmin = useIsAdmin();
  const updateStatus = useMutation(communityApi.items.updateStatus);
  const [eta, setEta] = useState(currentEta || "");
  const [resolvedVersion, setResolvedVersion] = useState(currentResolvedVersion || "");

  if (!isAdmin) return null;

  const handleStatusChange = (status: ItemStatus) => {
    updateStatus({ id: itemId as never, status });
  };

  const handlePriorityChange = (priority: ItemPriority) => {
    updateStatus({ id: itemId as never, priority });
  };

  const handleEtaSave = () => {
    if (eta !== currentEta) {
      updateStatus({ id: itemId as never, eta: eta || undefined });
    }
  };

  const handleVersionSave = () => {
    if (resolvedVersion !== currentResolvedVersion) {
      updateStatus({ id: itemId as never, resolvedVersion: resolvedVersion || undefined });
    }
  };

  return (
    <div className="border border-border-default rounded p-3 space-y-3 bg-bg-secondary">
      <h4 className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
        Admin Controls
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-text-tertiary block mb-1">Status</label>
          <Select
            options={statuses}
            value={currentStatus}
            onChange={(v) => handleStatusChange(v as ItemStatus)}
          />
        </div>

        <div>
          <label className="text-[10px] text-text-tertiary block mb-1">Priority</label>
          <Select
            options={[{ value: "", label: "None" }, ...priorities]}
            value={currentPriority || ""}
            onChange={(v) => handlePriorityChange(v as ItemPriority)}
          />
        </div>

        <div>
          <label className="text-[10px] text-text-tertiary block mb-1">ETA</label>
          <input
            type="text"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            onBlur={handleEtaSave}
            placeholder="e.g. Q2 2026"
            className="w-full bg-bg-primary border border-border-default rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
          />
        </div>

        <div>
          <label className="text-[10px] text-text-tertiary block mb-1">Resolved Version</label>
          <input
            type="text"
            value={resolvedVersion}
            onChange={(e) => setResolvedVersion(e.target.value)}
            onBlur={handleVersionSave}
            placeholder="e.g. v1.2.0"
            className="w-full bg-bg-primary border border-border-default rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
          />
        </div>
      </div>
    </div>
  );
}
