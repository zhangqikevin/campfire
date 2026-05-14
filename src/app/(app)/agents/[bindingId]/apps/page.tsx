import { AppsListView } from "@/components/apps/AppsListView";
import { TeamAppsSection } from "@/components/apps/TeamAppsSection";

interface PageProps {
  params: Promise<{ bindingId: string }>;
}

export default async function AppsPage({ params }: PageProps) {
  const { bindingId } = await params;
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-base font-semibold">Apps</h2>
        <p className="text-sm text-fg-muted">
          Live, reopenable surfaces. Team Apps are admin-maintained templates; Personal Apps are
          ones the agent built for you with <code className="font-mono">app_create</code>.
        </p>
      </header>
      <TeamAppsSection bindingId={bindingId} />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Personal Apps</h3>
        <AppsListView bindingId={bindingId} />
      </section>
    </div>
  );
}
