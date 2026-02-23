"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 w-full">
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const isPending = stepNum > currentStep;

        return (
          <div key={label} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-7 h-7 flex items-center justify-center text-[11px] font-mono font-semibold border transition-colors",
                  isCompleted &&
                    "bg-status-success border-status-success text-white",
                  isActive &&
                    "bg-accent-primary border-accent-primary text-white",
                  isPending &&
                    "bg-transparent border-border-default text-text-tertiary"
                )}
              >
                {isCompleted ? <Check size={14} /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-[10px] whitespace-nowrap",
                  isActive ? "text-text-primary font-semibold" : "text-text-tertiary"
                )}
              >
                {label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 h-px mx-2 mb-5",
                  stepNum < currentStep ? "bg-status-success" : "bg-border-default"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
