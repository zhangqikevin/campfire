import Link from "next/link";
import { BindingScope } from "@/components/agents/BindingScope";
import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";
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

  return (
    <BindingScope bindingId={binding.id} url={binding.url}>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
          <p className="font-mono text-xs text-fg-subtle">{binding.url}</p>
        </header>
        <WorkspaceNav />
        <div>{children}</div>
      </div>
    </BindingScope>
  );
}
