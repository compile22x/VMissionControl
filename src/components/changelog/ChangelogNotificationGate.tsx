/**
 * @module ChangelogNotificationGate
 * @description Guards the changelog notification modal behind Convex availability.
 * Prevents useQuery from being called without a ConvexReactClient parent.
 * @license GPL-3.0-only
 */

"use client";

import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { ChangelogNotificationModal } from "./ChangelogNotificationModal";

export function ChangelogNotificationGate() {
  const convexAvailable = useConvexAvailable();

  if (!convexAvailable) return null;

  return <ChangelogNotificationModal />;
}
