"use client";

import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import type { FlightMode } from "@/lib/types";
import { MODE_DESCRIPTIONS } from "@/components/fc/flight-mode-constants";
import type { UnifiedFlightMode } from "@/lib/protocol/types";

interface FlightModeSelectorProps {
  value: FlightMode;
  onChange: (mode: FlightMode) => void;
  className?: string;
}

const FLIGHT_MODES: SelectOption[] = [
  { value: "STABILIZE", label: "Stabilize", description: MODE_DESCRIPTIONS.STABILIZE },
  { value: "ALT_HOLD", label: "Alt Hold", description: MODE_DESCRIPTIONS.ALT_HOLD },
  { value: "LOITER", label: "Loiter", description: MODE_DESCRIPTIONS.LOITER },
  { value: "GUIDED", label: "Guided", description: MODE_DESCRIPTIONS.GUIDED },
  { value: "AUTO", label: "Auto", description: MODE_DESCRIPTIONS.AUTO },
  { value: "RTL", label: "RTL", description: MODE_DESCRIPTIONS.RTL },
  { value: "LAND", label: "Land", description: MODE_DESCRIPTIONS.LAND },
  { value: "MANUAL", label: "Manual", description: MODE_DESCRIPTIONS.MANUAL },
  { value: "ACRO", label: "Acro", description: MODE_DESCRIPTIONS.ACRO },
  { value: "FBWA", label: "FBWA", description: MODE_DESCRIPTIONS.FBWA },
  { value: "FBWB", label: "FBWB", description: MODE_DESCRIPTIONS.FBWB },
  { value: "CRUISE", label: "Cruise", description: MODE_DESCRIPTIONS.CRUISE },
  { value: "AUTOTUNE", label: "Autotune", description: MODE_DESCRIPTIONS.AUTOTUNE },
  { value: "CIRCLE", label: "Circle", description: MODE_DESCRIPTIONS.CIRCLE },
  { value: "TRAINING", label: "Training", description: MODE_DESCRIPTIONS.TRAINING },
  { value: "QSTABILIZE", label: "QStabilize", description: MODE_DESCRIPTIONS.QSTABILIZE },
  { value: "QHOVER", label: "QHover", description: MODE_DESCRIPTIONS.QHOVER },
  { value: "QLOITER", label: "QLoiter", description: MODE_DESCRIPTIONS.QLOITER },
  { value: "QLAND", label: "QLand", description: MODE_DESCRIPTIONS.QLAND },
  { value: "QRTL", label: "QRTL", description: MODE_DESCRIPTIONS.QRTL },
  { value: "POSHOLD", label: "PosHold", description: MODE_DESCRIPTIONS.POSHOLD },
  { value: "BRAKE", label: "Brake", description: MODE_DESCRIPTIONS.BRAKE },
  { value: "SMART_RTL", label: "Smart RTL", description: MODE_DESCRIPTIONS.SMART_RTL },
  { value: "DRIFT", label: "Drift", description: MODE_DESCRIPTIONS.DRIFT },
  { value: "SPORT", label: "Sport", description: MODE_DESCRIPTIONS.SPORT },
  { value: "FLIP", label: "Flip", description: MODE_DESCRIPTIONS.FLIP },
  { value: "THROW", label: "Throw", description: MODE_DESCRIPTIONS.THROW },
  { value: "QAUTOTUNE", label: "QAutotune", description: MODE_DESCRIPTIONS.QAUTOTUNE },
  { value: "QACRO", label: "QAcro", description: MODE_DESCRIPTIONS.QACRO },
  { value: "AVOID_ADSB", label: "Avoid ADS-B", description: MODE_DESCRIPTIONS.AVOID_ADSB },
  { value: "THERMAL", label: "Thermal", description: MODE_DESCRIPTIONS.THERMAL },
];

export function FlightModeSelector({ value, onChange, className }: FlightModeSelectorProps) {
  return (
    <Select
      options={FLIGHT_MODES}
      value={value}
      onChange={(v) => onChange(v as FlightMode)}
      className={className}
    />
  );
}
