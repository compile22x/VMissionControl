"use client";

import { useState } from "react";
import { Home, ArrowDownToLine, Pause, Power, XOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FlightModeSelector } from "@/components/shared/flight-mode-selector";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";

export function FlightControlsBar() {
  const armState = useDroneStore((s) => s.armState);
  const flightMode = useDroneStore((s) => s.flightMode);
  const setFlightMode = useDroneStore((s) => s.setFlightMode);
  const setArmState = useDroneStore((s) => s.setArmState);
  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);

  const [showRthConfirm, setShowRthConfirm] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);

  const isArmed = armState === "armed";
  const protocol = getProtocol();

  return (
    <>
      <div className="h-14 bg-bg-secondary border-t border-border-default flex items-center justify-between px-4 shrink-0">
        {/* Left: Flight actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Home size={14} />}
            onClick={() => setShowRthConfirm(true)}
            className="text-status-warning border-status-warning/30"
          >
            RTH
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowDownToLine size={14} />}
            onClick={() => {
              if (protocol) protocol.land();
              else setFlightMode("LAND");
            }}
          >
            LAND
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Pause size={14} />}
            onClick={() => {
              if (protocol) protocol.setFlightMode("LOITER");
              else setFlightMode("LOITER");
            }}
          >
            HOLD
          </Button>
        </div>

        {/* Center: ARM/DISARM + Mode */}
        <div className="flex items-center gap-3">
          <Button
            variant={isArmed ? "danger" : "primary"}
            size="sm"
            icon={<Power size={14} />}
            onClick={() => {
              if (protocol) {
                if (isArmed) protocol.disarm();
                else protocol.arm();
              } else {
                setArmState(isArmed ? "disarmed" : "armed");
              }
            }}
          >
            {isArmed ? "DISARM" : "ARM"}
          </Button>
          <FlightModeSelector
            value={flightMode}
            onChange={(mode) => {
              if (protocol) protocol.setFlightMode(mode);
              else setFlightMode(mode);
            }}
            className="w-28"
          />
        </div>

        {/* Right: Abort */}
        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            icon={<XOctagon size={14} />}
            onClick={() => setShowAbortConfirm(true)}
          >
            ABORT
          </Button>
        </div>
      </div>

      {/* RTH Confirmation */}
      <ConfirmDialog
        open={showRthConfirm}
        onCancel={() => setShowRthConfirm(false)}
        onConfirm={() => {
          if (protocol) protocol.returnToLaunch();
          else setFlightMode("RTL");
          setShowRthConfirm(false);
        }}
        title="Return to Home"
        message="The drone will abort its current mission and return to the home position. Are you sure?"
        confirmLabel="Return to Home"
        variant="primary"
      />

      {/* Abort Confirmation */}
      <ConfirmDialog
        open={showAbortConfirm}
        onCancel={() => setShowAbortConfirm(false)}
        onConfirm={() => {
          if (protocol) {
            protocol.land();
            protocol.disarm();
          } else {
            setFlightMode("LAND");
            setArmState("disarmed");
          }
          setShowAbortConfirm(false);
        }}
        title="Emergency Abort"
        message="This will immediately stop the mission and initiate emergency landing. This action cannot be undone. Are you sure?"
        confirmLabel="ABORT MISSION"
        variant="danger"
      />
    </>
  );
}
