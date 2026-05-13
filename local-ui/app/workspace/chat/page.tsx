"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChatSurface } from "@/components/chat/ChatSurface";
import { encodeMain } from "@/lib/agent-client/session-keys";

export const dynamic = "force-static";

function ChatPageInner() {
  const params = useSearchParams();
  const agentId = params?.get("agent") ?? "main";
  const sessionKey = encodeMain(agentId);
  return <ChatSurface sessionKey={sessionKey} />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg-muted">Loading…</p>}>
      <ChatPageInner />
    </Suspense>
  );
}
