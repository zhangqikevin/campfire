import { AddAgentBindingForm } from "@/components/agents/AddAgentBindingForm";
import { BindingsList } from "@/components/agents/BindingsList";
import { listBindingsForTenant } from "@/lib/agent-bindings/actions";

export const metadata = {
  title: "Agents · Campfire",
};

export default async function AgentsPage() {
  const bindings = await listBindingsForTenant();

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-fg-muted">
          Connect the agents you already run. The browser holds the connection;
          Campfire&apos;s server never sees your agent token.
        </p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add an agent</h2>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent">
              OpenClaw
            </span>
            <span className="inline-flex cursor-not-allowed items-center gap-1 rounded-full bg-bg-inset px-2 py-0.5 font-medium text-fg-subtle">
              Hermes
              <span className="text-[10px] uppercase tracking-wide">soon</span>
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-bg-subtle p-6">
          <AddAgentBindingForm />
        </div>
        <div className="rounded-md border border-border bg-bg-inset/40 p-3 text-xs text-fg-muted">
          <strong className="text-fg">Heads up:</strong> if you opened Campfire via
          an HTTPS URL (Codespaces, ngrok, …), browsers will block{" "}
          <code className="font-mono">ws://localhost</code> connections as
          mixed content. To bind a local OpenClaw, run Campfire locally too
          (<code className="font-mono">pnpm dev</code>) and open{" "}
          <code className="font-mono">http://localhost:3000</code>. Remote
          gateways must serve <code className="font-mono">wss://</code>.
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Your bindings</h2>
        <BindingsList bindings={bindings} />
      </section>
    </div>
  );
}
