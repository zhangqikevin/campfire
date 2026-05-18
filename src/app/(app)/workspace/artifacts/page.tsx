import { notFound } from "next/navigation";
import { ArtifactsListView } from "@/components/artifacts/ArtifactsListView";
import { getPrimaryBindingForCurrentUser } from "@/lib/agent-bindings/server";

export default async function WorkspaceArtifactsPage() {
  const binding = await getPrimaryBindingForCurrentUser();
  if (!binding) notFound();
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Artifacts</h2>
      <ArtifactsListView
        bindingId={binding.id}
        detailHrefPrefix="/workspace/artifacts"
      />
    </div>
  );
}
