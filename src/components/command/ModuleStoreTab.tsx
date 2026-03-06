"use client";

import { Package } from "lucide-react";

export function ModuleStoreTab() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3 max-w-sm">
        <Package size={32} className="text-text-tertiary mx-auto" />
        <h3 className="text-sm font-medium text-text-primary">
          Module Store
        </h3>
        <p className="text-xs text-text-tertiary leading-relaxed">
          Install, update, and manage agent modules and plugins.
          Coming in Phase 1.
        </p>
      </div>
    </div>
  );
}
