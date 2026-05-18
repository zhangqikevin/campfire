import Link from "next/link";
import { ArtifactDetailView } from "@/components/artifacts/ArtifactDetailView";

interface PageProps {
  params: Promise<{ artifactId: string }>;
}

export default async function WorkspaceArtifactDetailPage({ params }: PageProps) {
  const { artifactId } = await params;
  return (
    <div className="space-y-4">
      <Link href="/workspace/artifacts" className="text-xs text-fg-muted hover:text-fg">
        ← Artifacts
      </Link>
      <ArtifactDetailView artifactId={artifactId} />
    </div>
  );
}
