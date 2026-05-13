"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useGatewayQuery } from "@/lib/agent-client/react/useGatewayQuery";
import { useClient } from "@/lib/agent-client/react/useClient";
import { ConnectionState } from "@/lib/agent-client/types";

export const dynamic = "force-static";

interface ArtifactRecord {
  id: string;
  kind: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function ArtifactDetailInner({ artifactId }: { artifactId: string }) {
  const { state } = useClient();
  const { data, status, error } = useGatewayQuery<{ artifact: ArtifactRecord | null }>(
    "campfire.artifacts.get",
    { id: artifactId },
    artifactId,
  );

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return <p className="text-sm text-fg-muted">Not connected.</p>;
  }
  if (status === "loading" || status === "idle") return <p className="text-sm text-fg-muted">Loading…</p>;
  if (status === "error") return <p className="text-sm text-danger">{error}</p>;
  if (!data?.artifact) return <p className="text-sm text-fg-muted">Artifact not found.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{data.artifact.title || "Untitled"}</h2>
        <p className="mt-1 font-mono text-xs text-fg-subtle">
          {data.artifact.id} · {data.artifact.kind}
        </p>
      </div>
      <article className="rounded-lg border border-border bg-bg-subtle p-6">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-fg">
          {data.artifact.content}
        </pre>
      </article>
    </div>
  );
}

function ArtifactFromSearch() {
  const params = useSearchParams();
  const id = params?.get("id");
  if (!id) return <p className="text-sm text-fg-muted">Missing artifact id.</p>;
  return (
    <div className="space-y-4">
      <Link href="/workspace/artifacts/" className="text-xs text-fg-muted hover:text-fg">
        ← Artifacts
      </Link>
      <ArtifactDetailInner artifactId={id} />
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
