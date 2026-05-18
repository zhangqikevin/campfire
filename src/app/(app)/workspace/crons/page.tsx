import { notFound } from "next/navigation";
import { CronsListView } from "@/components/crons/CronsListView";
import { getPrimaryBindingForCurrentUser } from "@/lib/agent-bindings/server";

export default async function WorkspaceCronsPage() {
  const binding = await getPrimaryBindingForCurrentUser();
  if (!binding) notFound();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Crons</h2>
        <p className="text-sm text-fg-muted">
          Scheduled agent runs your gateway is managing. Each one fires on its schedule and runs
          its prompt against the bound agent.
        </p>
      </header>
      <CronsListView
        bindingId={binding.id}
        detailHref={(id) => `/workspace/crons/${id}`}
      />
    </div>
  );
}
