"use client";

import { useState, useCallback } from "react";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { HealthCheckWizard } from "@/components/wizard/HealthCheckWizard";
import { Select } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Satellite, Wifi, Rocket, Check } from "lucide-react";

const DRONE_OPTIONS = [
  { value: "", label: "-- Select a drone --" },
  { value: "alpha-1", label: "Alpha-1 (Sentry)" },
  { value: "bravo-2", label: "Bravo-2 (Survey)" },
  { value: "echo-5", label: "Echo-5 (SAR)" },
  { value: "charlie", label: "Charlie (Idle)" },
];

function StepSelectDrone({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text-primary">Select Drone</h3>
      <p className="text-xs text-text-secondary">
        Choose the drone you want to run the pre-flight wizard for.
      </p>
      <Select
        label="Drone"
        value={selected}
        onChange={onSelect}
        options={DRONE_OPTIONS}
      />
      {selected && (
        <div className="flex items-center gap-2 px-3 py-2 border border-border-default bg-bg-tertiary">
          <StatusDot status="online" />
          <span className="text-xs text-text-primary">
            {DRONE_OPTIONS.find((d) => d.value === selected)?.label}
          </span>
          <Badge variant="success" size="sm">
            Available
          </Badge>
        </div>
      )}
    </div>
  );
}

function StepConnection() {
  return (
    <div className="flex-1 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text-primary">Connection Status</h3>
      <p className="text-xs text-text-secondary">
        Verifying connection to selected drone.
      </p>
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex items-center gap-3 px-3 py-2 border border-status-success bg-status-success/5">
          <Wifi size={14} className="text-status-success" />
          <div className="flex-1">
            <div className="text-xs text-text-primary">MAVLink Connected</div>
            <div className="text-[10px] text-text-tertiary font-mono">
              Heartbeat: 1 Hz | Latency: 12 ms
            </div>
          </div>
          <StatusDot status="online" />
        </div>
        <div className="flex items-center gap-3 px-3 py-2 border border-status-success bg-status-success/5">
          <Satellite size={14} className="text-status-success" />
          <div className="flex-1">
            <div className="text-xs text-text-primary">Telemetry Stream</div>
            <div className="text-[10px] text-text-tertiary font-mono">
              Rate: 10 Hz | Channels: ATT, POS, BAT, GPS, VFR, RC
            </div>
          </div>
          <StatusDot status="online" />
        </div>
      </div>
    </div>
  );
}

function StepGpsLock() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 border-2 border-status-success flex items-center justify-center">
        <Satellite size={28} className="text-status-success" />
      </div>
      <h3 className="text-sm font-semibold text-status-success">GPS Lock Acquired</h3>
      <div className="text-center space-y-1">
        <div className="text-xs text-text-secondary">
          Fix Type: <span className="font-mono text-text-primary">3D Fix</span>
        </div>
        <div className="text-xs text-text-secondary">
          Satellites: <span className="font-mono text-text-primary">17</span>
        </div>
        <div className="text-xs text-text-secondary">
          HDOP: <span className="font-mono text-text-primary">0.9</span>
        </div>
        <div className="text-xs text-text-secondary">
          Position:{" "}
          <span className="font-mono text-text-primary">
            12.9766, 77.5993
          </span>
        </div>
      </div>
    </div>
  );
}

function StepReady({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className="w-20 h-20 border-2 border-status-success flex items-center justify-center">
        <Check size={36} className="text-status-success" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-display font-semibold text-status-success">
          Ready for Mission
        </h3>
        <p className="text-xs text-text-secondary max-w-xs">
          All pre-flight checks passed. GPS lock acquired. Drone is ready for
          mission deployment.
        </p>
      </div>
      <Button
        variant="primary"
        size="lg"
        icon={<Rocket size={16} />}
        onClick={onLaunch}
      >
        Launch Mission
      </Button>
    </div>
  );
}

export default function SmartWizardPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDrone, setSelectedDrone] = useState("");
  const [healthDone, setHealthDone] = useState(false);
  const { toast } = useToast();

  const handleNext = () => {
    if (currentStep < 5) setCurrentStep((s) => s + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const handleHealthComplete = useCallback(() => {
    setHealthDone(true);
  }, []);

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 1:
        return selectedDrone !== "";
      case 2:
        return true;
      case 3:
        return healthDone;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center h-full p-6">
      <WizardLayout
        currentStep={currentStep}
        onBack={handleBack}
        onNext={handleNext}
        canGoNext={canGoNext()}
      >
        {currentStep === 1 && (
          <StepSelectDrone selected={selectedDrone} onSelect={setSelectedDrone} />
        )}
        {currentStep === 2 && <StepConnection />}
        {currentStep === 3 && (
          <HealthCheckWizard onComplete={handleHealthComplete} />
        )}
        {currentStep === 4 && <StepGpsLock />}
        {currentStep === 5 && (
          <StepReady
            onLaunch={() =>
              toast("Mission launched! Redirecting to flight view...", "success")
            }
          />
        )}
      </WizardLayout>
    </div>
  );
}
