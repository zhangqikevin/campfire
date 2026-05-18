"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArtifactDetailView } from "@/components/artifacts/ArtifactDetailView";

export const dynamic = "force-static";

function ArtifactFromSearch() {
  const params = useSearchParams();
  const id = params?.get("id");
  if (!id) return <p className="text-sm text-fg-muted">Missing artifact id.</p>;
  return (
    <div className="space-y-4">
      <Link href="/workspace/artifacts/" className="text-xs text-fg-muted hover:text-fg">
        ← Artifacts
      </Link>
      <ArtifactDetailView artifactId={id} />
    </div>
  );
}

export default function ArtifactDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-fg-muted">Loading…</p>}>
      <ArtifactFromSearch />
    </Suspense>
  );
}
