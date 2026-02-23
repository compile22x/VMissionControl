"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFleetStore } from "@/stores/fleet-store";
import { FleetToolbar, type FleetViewMode } from "@/components/fleet/FleetToolbar";
import { FleetStats } from "@/components/fleet/FleetStats";
import { FleetGrid } from "@/components/fleet/FleetGrid";
import { FleetList } from "@/components/fleet/FleetList";
import { FleetMapView } from "@/components/fleet/FleetMapView";
import { AddDroneModal } from "@/components/fleet/AddDroneModal";
import type { FleetDrone } from "@/lib/types";

export default function FleetOverviewPage() {
  const router = useRouter();
  const drones = useFleetStore((s) => s.drones);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suiteFilter, setSuiteFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [viewMode, setViewMode] = useState<FleetViewMode>("grid");
  const [addModalOpen, setAddModalOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = [...drones];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q) ||
          (d.suiteName && d.suiteName.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }

    // Suite filter
    if (suiteFilter !== "all") {
      result = result.filter((d) => d.suiteType === suiteFilter);
    }

    // Sort
    result.sort((a: FleetDrone, b: FleetDrone) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "status":
          return a.status.localeCompare(b.status);
        case "battery":
          return (b.battery?.remaining ?? 0) - (a.battery?.remaining ?? 0);
        case "health":
          return b.healthScore - a.healthScore;
        default:
          return 0;
      }
    });

    return result;
  }, [drones, search, statusFilter, suiteFilter, sortBy]);

  const handleDroneClick = (id: string) => {
    router.push(`/fleet/${id}`);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-auto">
      <FleetToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        suiteFilter={suiteFilter}
        onSuiteFilterChange={setSuiteFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddDrone={() => setAddModalOpen(true)}
      />

      <FleetStats />

      {viewMode === "grid" && (
        <FleetGrid drones={filtered} onDroneClick={handleDroneClick} />
      )}
      {viewMode === "list" && (
        <FleetList drones={filtered} onDroneClick={handleDroneClick} />
      )}
      {viewMode === "map" && (
        <FleetMapView drones={filtered} onDroneClick={handleDroneClick} />
      )}

      <AddDroneModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </div>
  );
}
