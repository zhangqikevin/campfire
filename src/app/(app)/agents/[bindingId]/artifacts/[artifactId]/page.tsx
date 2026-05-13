import Link from "next/link";
import { ArtifactDetailView } from "@/components/artifacts/ArtifactDetailView";

interface PageProps {
  params: Promise<{ bindingId: string; artifactId: string }>;
}

export default async function ArtifactDetailPage({ params }: PageProps) {
  const { bindingId, artifactId } = await params;
  return (
    <div className="space-y-4">
      <Link
        href={`/agents/${bindingId}/artifacts`}
        className="text-xs text-fg-muted hover:text-fg"
      >
        ← Artifacts
      </Link>
      <ArtifactDetailView artifactId={artifactId} />
    </div>
  );
}
