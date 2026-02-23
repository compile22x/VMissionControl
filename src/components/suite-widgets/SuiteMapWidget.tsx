"use client";

import dynamic from "next/dynamic";
import type { WidgetProps } from "./types";
import { cn } from "@/lib/utils";

const MapWrapper = dynamic(
  () =>
    import("@/components/shared/map-wrapper").then((m) => ({
      default: m.MapWrapper,
    })),
  { ssr: false }
);

export function SuiteMapWidget({ className }: WidgetProps) {
  return (
    <div
      className={cn(
        "w-full h-40 border border-border-default overflow-hidden",
        className
      )}
    >
      <MapWrapper zoom={14} className="w-full h-full" />
    </div>
  );
}
