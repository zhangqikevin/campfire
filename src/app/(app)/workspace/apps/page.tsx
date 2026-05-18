import { notFound } from "next/navigation";
import { AppsListView } from "@/components/apps/AppsListView";
import { TeamAppsSection } from "@/components/apps/TeamAppsSection";
import { getPrimaryBindingForCurrentUser } from "@/lib/agent-bindings/server";

export default async function WorkspaceAppsPage() {
  const binding = await getPrimaryBindingForCurrentUser();
  if (!binding) notFound();

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Apps</h2>
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
