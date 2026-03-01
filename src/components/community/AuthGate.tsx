"use client";

import { useAuthStore } from "@/stores/auth-store";

interface AuthGateProps {
  children: React.ReactNode;
  action?: string;
}

export function AuthGate({ children, action = "continue" }: AuthGateProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-sm text-text-tertiary">
          Sign in to {action}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
