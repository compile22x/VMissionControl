"use client";

import type { ComponentType } from "react";
import { SuiteMapWidget } from "./SuiteMapWidget";
import { SuiteTableWidget } from "./SuiteTableWidget";
import { SuiteStatsWidget } from "./SuiteStatsWidget";
import { SuiteStatusWidget } from "./SuiteStatusWidget";
import type { WidgetProps } from "./types";

export type { WidgetProps };

const registry: Record<string, ComponentType<WidgetProps>> = {
  map: SuiteMapWidget,
  table: SuiteTableWidget,
  stats: SuiteStatsWidget,
  status: SuiteStatusWidget,
};

export function getWidget(type: string): ComponentType<WidgetProps> | null {
  return registry[type] ?? null;
}

export { registry as widgetRegistry };
