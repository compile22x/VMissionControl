"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutGrid, List, Map, Plus } from "lucide-react";

export type FleetViewMode = "grid" | "list" | "map";

interface FleetToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  suiteFilter: string;
  onSuiteFilterChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  viewMode: FleetViewMode;
  onViewModeChange: (mode: FleetViewMode) => void;
  onAddDrone: () => void;
}

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "online", label: "Online" },
  { value: "in_mission", label: "In Mission" },
  { value: "idle", label: "Idle" },
  { value: "returning", label: "Returning" },
  { value: "maintenance", label: "Maintenance" },
  { value: "offline", label: "Offline" },
];

const suiteOptions = [
  { value: "all", label: "All Suites" },
  { value: "sentry", label: "Sentry" },
  { value: "survey", label: "Survey" },
  { value: "agriculture", label: "Agriculture" },
  { value: "cargo", label: "Cargo" },
  { value: "sar", label: "SAR" },
  { value: "inspection", label: "Inspection" },
];

const sortOptions = [
  { value: "name", label: "Sort: Name" },
  { value: "status", label: "Sort: Status" },
  { value: "battery", label: "Sort: Battery" },
  { value: "health", label: "Sort: Health" },
];

const viewModes: { mode: FleetViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: "grid", icon: LayoutGrid, label: "Grid" },
  { mode: "list", icon: List, label: "List" },
  { mode: "map", icon: Map, label: "Map" },
];

export function FleetToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  suiteFilter,
  onSuiteFilterChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onAddDrone,
}: FleetToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-2 p-3 border-b border-border-default bg-bg-secondary">
      <div className="w-48">
        <Input
          placeholder="Search drones..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="w-36">
        <Select
          options={statusOptions}
          value={statusFilter}
          onChange={onStatusFilterChange}
        />
      </div>
      <div className="w-36">
        <Select
          options={suiteOptions}
          value={suiteFilter}
          onChange={onSuiteFilterChange}
        />
      </div>
      <div className="w-36">
        <Select
          options={sortOptions}
          value={sortBy}
          onChange={onSortChange}
        />
      </div>

      <div className="flex items-center border border-border-default">
        {viewModes.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            title={label}
            onClick={() => onViewModeChange(mode)}
            className={cn(
              "p-1.5 transition-colors cursor-pointer",
              viewMode === mode
                ? "bg-accent-primary text-white"
                : "text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary"
            )}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <div className="ml-auto">
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={onAddDrone}
        >
          Add Drone
        </Button>
      </div>
    </div>
  );
}
