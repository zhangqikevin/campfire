"use client";

import Link from "next/link";
import { useGatewayQuery } from "@/lib/agent-client/react/useGatewayQuery";
import { useClient } from "@/lib/agent-client/react/useClient";
import { ConnectionState } from "@/lib/agent-client/types";

interface ArtifactSummary {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ArtifactsListViewProps {
  bindingId: string;
}

export function ArtifactsListView({ bindingId }: ArtifactsListViewProps) {
  const { state } = useClient();
  const { data, status, error, refetch } = useGatewayQuery<{ artifacts?: ArtifactSummary[] }>(
    "campfire.artifacts.list",
    undefined,
    bindingId,
  );

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return (
      <p className="rounded-md border border-border bg-bg-subtle p-4 text-sm text-fg-muted">
        Not connected. Artifacts live on your gateway.
      </p>
    );
  }

  if (status === "loading" || status === "idle") {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }

  if (status === "error") {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm">
        <p className="text-danger">{error}</p>
        <p className="mt-2 text-xs text-fg-muted">
          Likely cause: <code className="font-mono">campfire-plugin</code> is not installed on
          this gateway. Build and install it from the <code className="font-mono">plugin/</code>{" "}
          directory of this repo, then reconnect.
        </p>
        <button
          onClick={refetch}
          className="mt-3 text-xs font-medium text-fg underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  const artifacts = data?.artifacts ?? [];

  if (artifacts.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-sm text-fg-muted">
        No artifacts yet. The agent creates these via{" "}
        <code className="font-mono">create_markdown_artifact</code> for reports, summaries, and
        reference material worth saving.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-subtle">
      {artifacts.map((a) => (
        <li key={a.id}>
          <Link
            href={`/agents/${bindingId}/artifacts/${a.id}`}
            className="flex items-center justify-between p-4 hover:bg-bg-inset/60"
          >
            <div>
              <div className="font-medium">{a.title || "Untitled"}</div>
              <div className="mt-0.5 text-xs text-fg-subtle">
                {a.kind} · Updated {new Date(a.updatedAt).toLocaleString()}
              </div>
            </div>
            <span className="font-mono text-xs text-fg-subtle">{a.id.slice(0, 8)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
