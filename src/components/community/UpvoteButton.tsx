"use client";

import { useMutation, useQuery } from "convex/react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { communityApi } from "@/lib/community-api";
import { useAuthStore } from "@/stores/auth-store";

interface UpvoteButtonProps {
  itemId: string;
  count: number;
}

export function UpvoteButton({ itemId, count }: UpvoteButtonProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const upvote = useMutation(communityApi.items.upvote);
  const myUpvotes = useQuery(
    communityApi.items.myUpvotes,
    isAuthenticated ? {} : "skip"
  );

  const hasUpvoted = myUpvotes?.includes(itemId) ?? false;

  const handleClick = () => {
    if (!isAuthenticated) return;
    upvote({ id: itemId as never });
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isAuthenticated}
      title={isAuthenticated ? (hasUpvoted ? "Remove vote" : "Upvote") : "Sign in to vote"}
      className={cn(
        "flex flex-col items-center gap-0.5 px-2 py-1 rounded transition-colors text-xs",
        hasUpvoted
          ? "text-accent-primary bg-accent-primary/10"
          : "text-text-tertiary hover:text-text-secondary",
        !isAuthenticated && "cursor-not-allowed opacity-60"
      )}
    >
      <ChevronUp size={14} />
      <span className="font-mono tabular-nums text-[10px]">{count}</span>
    </button>
  );
}
