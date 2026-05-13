import { ArtifactsListView } from "@/components/artifacts/ArtifactsListView";

interface PageProps {
  params: Promise<{ bindingId: string }>;
}

export default async function ArtifactsPage({ params }: PageProps) {
  const { bindingId } = await params;
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Artifacts</h2>
        <p className="text-sm text-fg-muted">
          Durable markdown documents the agent saved via{" "}
          <code className="font-mono">create_markdown_artifact</code>.
        </p>
      </header>
      <ArtifactsListView bindingId={bindingId} />
    </div>
  );
}
