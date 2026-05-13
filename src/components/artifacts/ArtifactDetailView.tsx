"use client";

import { useGatewayQuery } from "@/lib/agent-client/react/useGatewayQuery";
import { useClient } from "@/lib/agent-client/react/useClient";
import { ConnectionState } from "@/lib/agent-client/types";

interface ArtifactRecord {
  id: string;
  kind: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface ArtifactDetailViewProps {
  artifactId: string;
}

export function ArtifactDetailView({ artifactId }: ArtifactDetailViewProps) {
  const { state } = useClient();
  const { data, status, error } = useGatewayQuery<{ artifact: ArtifactRecord | null }>(
    "campfire.artifacts.get",
    { id: artifactId },
    artifactId,
  );

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return (
      <p className="rounded-md border border-border bg-bg-subtle p-4 text-sm text-fg-muted">
        Not connected.
      </p>
    );
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
        {/* MVP: render as pre-wrapped monospace. Markdown pretty-printing
            (react-markdown + remark-gfm) is a deliberate next-pass upgrade. */}
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-fg">
          {data.artifact.content}
        </pre>
      </article>
    </div>
  );
}
