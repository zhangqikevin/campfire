"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasToken } from "@/lib/agent-bindings/token-store";

export const dynamic = "force-static";

export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    // If a token already lives in IndexedDB from a previous setup, jump
    // straight into the workspace. Otherwise nudge to setup.
    void (async () => {
      const present = await hasToken("local");
      router.replace(present ? "/workspace/" : "/setup/");
    })();
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-fg-muted">Loading…</p>
    </main>
  );
}
