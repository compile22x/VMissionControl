"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { randomId } from "@/lib/utils";

type ToastStatus = "success" | "warning" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  status: ToastStatus;
}

interface ToastContextValue {
  toast: (message: string, status?: ToastStatus) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const borderColors: Record<ToastStatus, string> = {
  success: "border-l-status-success",
  warning: "border-l-status-warning",
  error: "border-l-status-error",
  info: "border-l-accent-primary",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, status: ToastStatus = "info") => {
    const id = randomId();
    setToasts((prev) => [...prev, { id, message, status }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border-default border-l-2 min-w-[240px]",
              borderColors[t.status]
            )}
          >
            <span className="text-xs text-text-primary flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-text-tertiary hover:text-text-primary"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
