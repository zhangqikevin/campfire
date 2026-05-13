import { AppsListView } from "@/components/apps/AppsListView";

interface PageProps {
  params: Promise<{ bindingId: string }>;
}

export default async function AppsPage({ params }: PageProps) {
  const { bindingId } = await params;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Apps</h2>
        <p className="text-sm text-fg-muted">
          Live, reopenable surfaces the agent built with <code className="font-mono">app_create</code>.
        </p>
      </header>
      <AppsListView bindingId={bindingId} />
    </div>
  );
}
