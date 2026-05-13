import { CronsListView } from "@/components/crons/CronsListView";

interface PageProps {
  params: Promise<{ bindingId: string }>;
}

export default async function CronsPage({ params }: PageProps) {
  const { bindingId } = await params;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Crons</h2>
        <p className="text-sm text-fg-muted">
          Scheduled agent runs your gateway is managing. Each one fires on its schedule and runs
          its prompt against the bound agent.
        </p>
      </header>
      <CronsListView bindingId={bindingId} />
    </div>
  );
}
