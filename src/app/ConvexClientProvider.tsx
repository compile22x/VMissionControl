"use client";

import { ReactNode, useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const client = useMemo(() => {
    if (!CONVEX_URL) return null;
    return new ConvexReactClient(CONVEX_URL);
  }, []);

  if (!client) {
    // Pure local mode — no Convex, no auth
    return <>{children}</>;
  }

  return (
    <ConvexAuthNextjsProvider client={client}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
