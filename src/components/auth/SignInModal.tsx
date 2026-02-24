/**
 * @module SignInModal
 * @description Modal dialog for optional sign-in. Appears as an overlay,
 * not a page redirect. Supports sign-in and account creation.
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
}

export function SignInModal({ open, onClose }: SignInModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auth:signIn",
          args: {
            provider: "password",
            params: {
              email,
              password,
              ...(mode === "signUp" ? { fullName, flow: "signUp" } : { flow: "signIn" }),
            },
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Authentication failed");
        return;
      }

      if (data.tokens?.token) {
        setAuth({
          id: email,
          name: fullName || email.split("@")[0],
          email,
        });
        onClose();
      }
    } catch {
      setError("Network error — check your connection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-border-default w-full max-w-sm mx-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <X size={16} />
        </button>

        <h2 className="text-lg font-display font-semibold text-text-primary mb-1">
          {mode === "signIn" ? "Sign In" : "Create Account"}
        </h2>
        <p className="text-xs text-text-secondary mb-4">
          {mode === "signIn"
            ? "Sign in to sync your missions across devices."
            : "Create an account to back up your data to the cloud."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signUp" && (
            <div>
              <label className="text-[10px] text-text-secondary uppercase tracking-wider block mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] text-text-secondary uppercase tracking-wider block mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-[10px] text-text-secondary uppercase tracking-wider block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-bg-primary border border-border-default px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-status-error">{error}</p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={loading}
          >
            {mode === "signIn" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError(null);
            }}
            className="text-xs text-accent-primary hover:underline"
          >
            {mode === "signIn" ? "Create an account" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-border-default text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-text-tertiary hover:text-text-secondary"
          >
            Continue without account
          </button>
        </div>
      </div>
    </div>
  );
}
