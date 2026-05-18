import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { listBindingsForTenant } from "@/lib/agent-bindings/actions";

export const metadata = {
  title: "Dashboard · Campfire",
};

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const bindings = await listBindingsForTenant();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re in.</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Signed in as <span className="text-fg">{email}</span>.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-bg-subtle p-6">
        <h2 className="text-base font-semibold">
          {bindings.length === 0 ? "Next step: bind an agent" : "Your agents"}
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          {bindings.length === 0
            ? "Campfire is the UI — the agent is yours. Connect your OpenClaw gateway from your browser; the token stays in this browser only, never on Campfire's servers."
            : `${bindings.length} binding${bindings.length === 1 ? "" : "s"} configured. Chat surface coming next.`}
        </p>
        <div className="mt-4">
          <Link href="/agents">
            <Button variant="primary">
              {bindings.length === 0 ? "Bind an agent" : "Manage agents"}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
