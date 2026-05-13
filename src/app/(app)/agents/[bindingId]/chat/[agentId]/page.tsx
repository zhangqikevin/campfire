import { ChatSurface } from "@/components/chat/ChatSurface";
import { encodeMain } from "@/lib/agent-client/session-keys";

interface PageProps {
  params: Promise<{ bindingId: string; agentId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { agentId } = await params;
  const sessionKey = encodeMain(agentId);
  return <ChatSurface sessionKey={sessionKey} />;
}
