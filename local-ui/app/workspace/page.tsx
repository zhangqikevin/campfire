"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-static";

export default function WorkspaceRoot() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/workspace/chat/");
  }, [router]);
  return <p className="text-sm text-fg-muted">Loading…</p>;
}
