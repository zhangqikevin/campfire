"use client";

import { ChatSurface } from "@/components/chat/ChatSurface";
import { encodeMain } from "@/lib/agent-client/session-keys";

const DEFAULT_AGENT_ID = "main";

/**
 * Permanent chat pane that lives in the middle column of /workspace.
 *
 * Kept as its own client component so the workspace layout (a Server
 * Component) doesn't need to bring in the chat client tree directly. The
 * sessionKey is fixed — multi-persona support is a future addition.
 */
export function WorkspaceChatPane() {
  const sessionKey = encodeMain(DEFAULT_AGENT_ID);
  return <ChatSurface sessionKey={sessionKey} />;
}
