import { notFound } from "next/navigation";
import { AppsListView } from "@/components/apps/AppsListView";
import { TeamAppsSection } from "@/components/apps/TeamAppsSection";
import { getPrimaryBindingForCurrentUser } from "@/lib/agent-bindings/server";

export default async function WorkspaceAppsPage() {
  const binding = await getPrimaryBindingForCurrentUser();
  if (!binding) notFound();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-base font-semibold">Apps</h2>
        <p className="text-sm text-fg-muted">
          Team Apps are admin-maintained templates; Personal Apps are ones the agent built for
          you with <code className="font-mono">app_create</code>.
        </p>
      </header>
      <TeamAppsSection
        bindingId={binding.id}
        detailHrefPrefix="/workspace/team-apps"
      />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Personal Apps</h3>
        <AppsListView
          bindingId={binding.id}
          detailHrefPrefix="/workspace/apps"
        />
      </section>
    </div>
  );
}
