import Link from "next/link";
import { BindingScope } from "@/components/agents/BindingScope";
import { WorkspaceChatPane } from "@/components/workspace/WorkspaceChatPane";
import { WorkspaceResizable } from "@/components/workspace/WorkspaceResizable";
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
      <div className="mx-auto max-w-5xl rounded-lg border border-dashed border-border p-8 text-center">
        <h2 className="text-base font-semibold">No agent yet</h2>
        <p className="mt-2 text-sm text-fg-muted">
          Your admin hasn&apos;t provisioned an OpenClaw binding for this account.
          Ask them to create one in <span className="font-mono">/admin/accounts</span>,
          or check <Link href="/agents" className="underline">/agents</Link>.
        </p>
      </div>
    );
  }

  // Layout:
  //   < md  → stacked vertically (sidebar = horizontal scroll, then chat,
  //           then content). Chat panel still renders permanently so the
  //           WS connection survives nav between tabs.
  //   ≥ md  → 3 columns: 176px sidebar | resizable split (chat | content).
  //           User can drag the divider; ratio persists in localStorage.
  return (
    <BindingScope bindingId={binding.id} url={binding.url}>
      <div className="flex flex-col gap-3 md:h-[calc(100dvh-7rem)] md:flex-row md:gap-6">
        <aside className="md:w-44 md:flex-shrink-0">
          <p className="mb-3 truncate font-mono text-xs text-fg-subtle">{binding.url}</p>
          <WorkspaceSideNav />
        </aside>
        {/* On md+: resizable split fills the rest. On mobile: stack chat + content. */}
        <div className="hidden min-w-0 flex-1 md:block">
          <WorkspaceResizable
            middle={<WorkspaceChatPane />}
            right={children}
          />
        </div>
        <div className="space-y-6 md:hidden">
          <WorkspaceChatPane />
          <div>{children}</div>
        </div>
      </div>
    </BindingScope>
  );
}
