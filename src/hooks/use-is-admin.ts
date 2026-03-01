"use client";

import { useQuery } from "convex/react";
import { communityApi } from "@/lib/community-api";

export function useIsAdmin(): boolean {
  const profile = useQuery(communityApi.profiles.getMyProfile);
  return profile?.role === "admin";
}
