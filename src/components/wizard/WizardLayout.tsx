"use client";

import type { ReactNode } from "react";
import { StepIndicator } from "@/components/wizard/StepIndicator";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STEP_LABELS = ["Select Drone", "Connection", "Sensors", "GPS Lock", "Ready"];

interface WizardLayoutProps {
  currentStep: number;
  onBack: () => void;
  onNext: () => void;
  canGoNext?: boolean;
  children: ReactNode;
}

export function WizardLayout({
  currentStep,
  onBack,
  onNext,
  canGoNext = true,
  children,
}: WizardLayoutProps) {
  const isFirst = currentStep === 1;
  const isLast = currentStep === STEP_LABELS.length;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[600px]">
      <StepIndicator steps={STEP_LABELS} currentStep={currentStep} />

      <div className="bg-bg-secondary border border-border-default p-6 min-h-[320px] flex flex-col">
        {children}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          icon={<ChevronLeft size={14} />}
          onClick={onBack}
          disabled={isFirst}
        >
          Back
        </Button>

        {!isLast && (
          <Button
            variant="primary"
            onClick={onNext}
            disabled={!canGoNext}
          >
            Next
            <ChevronRight size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
