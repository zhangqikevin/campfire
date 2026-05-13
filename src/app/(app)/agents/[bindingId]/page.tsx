import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ bindingId: string }>;
}

export default async function BindingIndexPage({ params }: PageProps) {
  // Default landing for a binding workspace is the chat surface with the
  // gateway's primary agent ("main" is the OpenClaw convention).
  const { bindingId } = await params;
  redirect(`/agents/${bindingId}/chat/main`);
}
