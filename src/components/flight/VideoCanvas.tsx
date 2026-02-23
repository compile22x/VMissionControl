"use client";

import { useVideoStore } from "@/stores/video-store";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface VideoCanvasProps {
  children?: ReactNode;
  className?: string;
}

export function VideoCanvas({ children, className }: VideoCanvasProps) {
  const isStreaming = useVideoStore((s) => s.isStreaming);
  const isRecording = useVideoStore((s) => s.isRecording);
  const fps = useVideoStore((s) => s.fps);
  const latencyMs = useVideoStore((s) => s.latencyMs);
  const resolution = useVideoStore((s) => s.resolution);

  return (
    <div
      className={cn(
        "relative w-full h-full bg-bg-primary overflow-hidden",
        className
      )}
    >
      {/* 16:9 video area */}
      <div className="absolute inset-0 flex items-center justify-center">
        {!isStreaming && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 border border-border-default flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-text-tertiary"
              >
                <path d="M1 1l22 22M21 10.5V5a2 2 0 00-2-2H5" />
                <path d="M10.5 5H19a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7" />
              </svg>
            </div>
            <span className="text-sm font-mono text-text-tertiary tracking-wider">
              NO SIGNAL
            </span>
          </div>
        )}
      </div>

      {/* Top-left: REC indicator */}
      {isRecording && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-status-error animate-pulse" />
          <span className="text-xs font-mono font-semibold text-status-error tracking-wider">
            REC
          </span>
        </div>
      )}

      {/* Top-right: Video stats */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <Badge variant="neutral" size="sm">
          {resolution}
        </Badge>
        <Badge
          variant={fps > 0 ? "success" : "neutral"}
          size="sm"
        >
          {fps} FPS
        </Badge>
        <Badge
          variant={latencyMs > 200 ? "warning" : latencyMs > 0 ? "success" : "neutral"}
          size="sm"
        >
          {latencyMs}ms
        </Badge>
      </div>

      {/* OSD overlay and other children */}
      {children}
    </div>
  );
}
