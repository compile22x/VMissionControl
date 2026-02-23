import type { Metadata } from "next";
import "./globals.css";
import { CommandShell } from "@/components/layout/CommandShell";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Altnautica Command",
  description: "Open-source Ground Control Station",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="h-dvh overflow-hidden bg-bg-primary text-text-primary font-body">
        <ToastProvider>
          <CommandShell>{children}</CommandShell>
        </ToastProvider>
      </body>
    </html>
  );
}
