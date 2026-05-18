import Link from "next/link";
import { BindingScope } from "@/components/agents/BindingScope";
import { WorkspaceChatPane } from "@/components/workspace/WorkspaceChatPane";
import { WorkspaceSideNav } from "@/components/workspace/WorkspaceSideNav";
import { getPrimaryBindingForCurrentUser } from "@/lib/agent-bindings/server";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const binding = await getPrimaryBindingForCurrentUser();

  if (!binding) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <h2 className="text-base font-semibold">No agent yet</h2>
        <p className="mt-2 text-sm text-fg-muted">
          Your admin hasn&apos;t provisioned an OpenClaw binding for this account.
          Ask them to create one in <span className="font-mono">/admin/accounts</span>,
          or check <Link href="/agents" className="underline">/agents</Link>.
        </p>
      </div>
    );
  }

  // Three-column layout. The left column is a persistent nav; the middle
  // column always shows the chat (so the WS connection + thread state survive
  // tab switches in the right column); the right column shows whatever
  // /workspace/<tab>/page.tsx renders.
  return (
    <BindingScope bindingId={binding.id} url={binding.url}>
      <div className="space-y-2">
        <p className="font-mono text-xs text-fg-subtle">{binding.url}</p>
        <div className="grid grid-cols-[176px_minmax(0,1fr)_minmax(0,1fr)] gap-6">
          <aside>
            <WorkspaceSideNav />
          </aside>
          <section className="min-w-0">
            <WorkspaceChatPane />
          </section>
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </BindingScope>
  );
}
