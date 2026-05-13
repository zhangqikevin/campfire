"use client";

import Link from "next/link";
import { useGatewayQuery } from "@/lib/agent-client/react/useGatewayQuery";
import { useClient } from "@/lib/agent-client/react/useClient";
import { ConnectionState } from "@/lib/agent-client/types";

interface AppSummary {
  id: string;
  title: string;
  agentId?: string;
  sessionKey?: string;
  createdAt: string;
  updatedAt: string;
}

interface AppsListViewProps {
  bindingId: string;
}

export function AppsListView({ bindingId }: AppsListViewProps) {
  const { state } = useClient();
  const { data, status, error, refetch } = useGatewayQuery<{ apps?: AppSummary[] }>(
    "campfire.apps.list",
    undefined,
    bindingId,
  );

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return (
      <p className="rounded-md border border-border bg-bg-subtle p-4 text-sm text-fg-muted">
        Not connected to the gateway. Apps live on your gateway and are only
        reachable while the connection is open.
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

  const apps = data?.apps ?? [];

  if (apps.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-sm text-fg-muted">
        No apps yet. Ask the agent to build one — e.g. &ldquo;Make me a dashboard for X&rdquo;.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-subtle">
      {apps.map((app) => (
        <li key={app.id}>
          <Link
            href={`/agents/${bindingId}/apps/${app.id}`}
            className="flex items-center justify-between p-4 hover:bg-bg-inset/60"
          >
            <div>
              <div className="font-medium">{app.title || "Untitled"}</div>
              <div className="mt-0.5 text-xs text-fg-subtle">
                Updated {new Date(app.updatedAt).toLocaleString()}
              </div>
            </div>
            <span className="font-mono text-xs text-fg-subtle">{app.id.slice(0, 8)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
