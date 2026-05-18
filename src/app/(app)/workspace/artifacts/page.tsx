import { notFound } from "next/navigation";
import { ArtifactsListView } from "@/components/artifacts/ArtifactsListView";
import { getPrimaryBindingForCurrentUser } from "@/lib/agent-bindings/server";

export default async function WorkspaceArtifactsPage() {
  const binding = await getPrimaryBindingForCurrentUser();
  if (!binding) notFound();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Artifacts</h2>
        <p className="text-sm text-fg-muted">
          Durable markdown documents the agent saved via{" "}
          <code className="font-mono">create_markdown_artifact</code>.
        </p>
      </header>
      <ArtifactsListView
        bindingId={binding.id}
        detailHref={(id) => `/workspace/artifacts/${id}`}
      />
    </div>
  );
}
