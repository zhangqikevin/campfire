import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ bindingId: string }>;
}

export default async function ChatIndexPage({ params }: PageProps) {
  const { bindingId } = await params;
  // Default persona on the gateway is `main`. Multi-agent picker comes later;
  // for MVP we land on main and let the user navigate elsewhere if needed.
  redirect(`/agents/${bindingId}/chat/main`);
}
