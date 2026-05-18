"use client";

import Link from "next/link";
import { useGatewayQuery } from "@/lib/agent-client/react/useGatewayQuery";
import { useClient } from "@/lib/agent-client/react/useClient";
import { ConnectionState } from "@/lib/agent-client/types";
import { cronStatusBadge, humanFrequency, relTime, type CronJobRecord } from "@/lib/cron";

interface CronsListViewProps {
  bindingId: string;
  detailHref?: (cronId: string) => string;
}

const TONE_CLASS: Record<"ok" | "warn" | "muted" | "danger", string> = {
  ok: "bg-accent/15 text-accent",
  warn: "bg-bg-inset text-fg",
  muted: "bg-bg-inset text-fg-subtle",
  danger: "bg-danger/15 text-danger",
};

export function CronsListView({ bindingId, detailHref }: CronsListViewProps) {
  const hrefFor = detailHref ?? ((id: string) => `/agents/${bindingId}/crons/${id}`);
  const { state } = useClient();
  const { data, status, error, refetch } = useGatewayQuery<{ jobs?: CronJobRecord[] }>(
    "cron.list",
    { limit: 50, includeDisabled: true },
    bindingId,
  );

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return (
      <p className="rounded-md border border-border bg-bg-subtle p-4 text-sm text-fg-muted">
        Not connected to the gateway. Crons live on your gateway and are only reachable while
        the connection is open.
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
        <button
          onClick={refetch}
          className="mt-3 text-xs font-medium text-fg underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  const jobs = data?.jobs ?? [];

  if (jobs.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-sm text-fg-muted">
        No cron jobs yet. Ask the agent to set one up — e.g. &ldquo;every morning at 7am, brief me
        on overnight GitHub activity.&rdquo;
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-subtle">
      {jobs.map((job) => {
        const badge = cronStatusBadge(job);
        return (
          <li key={job.id}>
            <Link
              href={hrefFor(job.id)}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 p-4 hover:bg-bg-inset/60"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{job.name || "Untitled"}</div>
                {job.description ? (
                  <div className="mt-0.5 truncate text-xs text-fg-subtle">{job.description}</div>
                ) : null}
              </div>
              <span className="font-mono text-xs text-fg-muted">{humanFrequency(job)}</span>
              <span className="text-xs text-fg-muted">{relTime(job.state?.lastRunAtMs)}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[badge.tone]}`}
              >
                {badge.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
