"use client";

import { KanbanBoard } from "@/components/community/KanbanBoard";
import { useIsAdmin } from "@/hooks/use-is-admin";

export default function KanbanPage() {
  const isAdmin = useIsAdmin();

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
        Admin access required
      </div>
    );
  }

  return <KanbanBoard />;
}
