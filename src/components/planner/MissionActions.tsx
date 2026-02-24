/**
 * @module MissionActions
 * @description Action bar at the bottom of the planner right panel.
 * Upload to drone (primary), save/load buttons (open modals), and overflow menu
 * (download from drone, reverse waypoints, discard changes).
 * @license GPL-3.0-only
 */
"use client";

import { Upload, Save, FolderOpen, MoreHorizontal, Download, ArrowDownUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

interface MissionActionsProps {
  hasWaypoints: boolean;
  hasDrone: boolean;
  uploadState: "idle" | "uploading" | "uploaded" | "error";
  onUpload: () => void;
  onSave: () => void;
  onLoad: () => void;
  onDownloadFromDrone: () => void;
  onReverseWaypoints: () => void;
  onDiscard: () => void;
}

export function MissionActions({
  hasWaypoints,
  hasDrone,
  uploadState,
  onUpload,
  onSave,
  onLoad,
  onDownloadFromDrone,
  onReverseWaypoints,
  onDiscard,
}: MissionActionsProps) {
  const overflowItems = [
    { id: "download-drone", label: "Download from Drone", icon: <Download size={12} /> },
    { id: "div1", label: "", divider: true },
    { id: "reverse", label: "Reverse Waypoints", icon: <ArrowDownUp size={12} /> },
    { id: "div2", label: "", divider: true },
    { id: "discard", label: "Discard Changes", icon: <Trash2 size={12} />, danger: true },
  ];

  const handleOverflow = (id: string) => {
    if (id === "download-drone") onDownloadFromDrone();
    else if (id === "reverse") onReverseWaypoints();
    else if (id === "discard") onDiscard();
  };

  return (
    <div className="border-t border-border-default p-3 flex flex-col gap-2">
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        icon={<Upload size={14} />}
        disabled={!hasWaypoints || !hasDrone}
        loading={uploadState === "uploading"}
        onClick={onUpload}
      >
        Upload to Drone
      </Button>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          icon={<Save size={12} />}
          disabled={!hasWaypoints}
          onClick={onSave}
        >
          Save
        </Button>
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          icon={<FolderOpen size={12} />}
          onClick={onLoad}
        >
          Load
        </Button>
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="md" icon={<MoreHorizontal size={14} />} />
          }
          items={overflowItems}
          onSelect={handleOverflow}
          align="right"
        />
      </div>
    </div>
  );
}
