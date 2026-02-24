/**
 * @module EmptyFleetState
 * @description Full-area empty state when no drones are in the fleet.
 * @license GPL-3.0-only
 */

"use client";

import { Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectDialogStore } from "@/stores/connect-dialog-store";

export function EmptyFleetState() {
  const openDialog = useConnectDialogStore((s) => s.openDialog);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <Plug size={48} className="text-text-tertiary" />
        <div>
          <h2 className="text-lg font-display font-semibold text-text-primary">
            No Drones Connected
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Connect a flight controller via USB or network to get started with
            ADOS Mission Control.
          </p>
        </div>
        <Button variant="primary" icon={<Plug size={14} />} onClick={openDialog}>
          Connect Drone
        </Button>
        <p className="text-[10px] text-text-tertiary">
          <kbd className="border border-border-default px-1 py-0.5 font-mono">⌘K</kbd>{" "}
          to open command palette
        </p>
      </div>
    </div>
  );
}
