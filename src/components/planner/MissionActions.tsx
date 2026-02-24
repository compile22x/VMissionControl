/**
 * @module MissionActions
 * @description Action bar at the bottom of the planner right panel.
 * Upload to drone (primary), save/load buttons, and overflow menu
 * (download from drone, export, clear all).
 * @license GPL-3.0-only
 */
"use client";

import { useRef } from "react";
import { Upload, Save, FolderOpen, MoreHorizontal, Download, FileDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

interface MissionActionsProps {
  hasWaypoints: boolean;
  hasDrone: boolean;
  uploadState: "idle" | "uploading" | "uploaded" | "error";
  onUpload: () => void;
  onSave: () => void;
  onLoadFile: (file: File) => void;
  onLoadRecent: () => void;
  onDownloadFromDrone: () => void;
  onExportWaypoints: () => void;
  onClearAll: () => void;
}

export function MissionActions({
  hasWaypoints,
  hasDrone,
  uploadState,
  onUpload,
  onSave,
  onLoadFile,
  onLoadRecent,
  onDownloadFromDrone,
  onExportWaypoints,
  onClearAll,
}: MissionActionsProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const overflowItems = [
    { id: "download-drone", label: "Download from Drone", icon: <Download size={12} /> },
    { id: "export", label: "Export .waypoints", icon: <FileDown size={12} /> },
    { id: "clear", label: "Clear All", icon: <Trash2 size={12} />, danger: true },
  ];

  const handleOverflow = (id: string) => {
    if (id === "download-drone") onDownloadFromDrone();
    else if (id === "export") onExportWaypoints();
    else if (id === "clear") onClearAll();
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
          onClick={() => fileRef.current?.click()}
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

      <input
        ref={fileRef}
        type="file"
        accept=".altmission,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onLoadFile(file);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
