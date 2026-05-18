import { ChatSurface } from "@/components/chat/ChatSurface";
import { encodeMain } from "@/lib/agent-client/session-keys";

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function WorkspaceChatPage({ params }: PageProps) {
  const { agentId } = await params;
  const sessionKey = encodeMain(agentId);
  return <ChatSurface sessionKey={sessionKey} />;
}
