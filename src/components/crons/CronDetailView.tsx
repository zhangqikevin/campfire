"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  CronScheduleEditor,
  type SchedulePatch,
} from "@/components/crons/CronScheduleEditor";
import { useClient } from "@/lib/agent-client/react/useClient";
import { useGatewayQuery } from "@/lib/agent-client/react/useGatewayQuery";
import { ConnectionState } from "@/lib/agent-client/types";
import {
  cronStatusBadge,
  humanFrequency,
  relTime,
  type CronJobRecord,
  type CronRunEntry,
} from "@/lib/cron";

interface CronDetailViewProps {
  cronId: string;
  /** Where to land after a successful delete. Required because this component
   *  is shared between SaaS (/agents/:bindingId/crons) and local-ui
   *  (/workspace/crons/) which have different parent routes. */
  listHref: string;
}

const TONE_CLASS: Record<"ok" | "warn" | "muted" | "danger", string> = {
  ok: "bg-accent/15 text-accent",
  warn: "bg-bg-inset text-fg",
  muted: "bg-bg-inset text-fg-subtle",
  danger: "bg-danger/15 text-danger",
};

export function CronDetailView({ cronId, listHref }: CronDetailViewProps) {
  const router = useRouter();
  const { client, state } = useClient();
  const { data: jobsData, status: jobsStatus, refetch: refetchJobs } = useGatewayQuery<{
    jobs?: CronJobRecord[];
  }>("cron.list", { limit: 100, includeDisabled: true }, cronId);
  const { data: runsData, status: runsStatus, refetch: refetchRuns } = useGatewayQuery<{
    entries?: CronRunEntry[];
  }>("cron.runs", { scope: "all", limit: 30 }, cronId);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return <p className="text-sm text-fg-muted">Not connected.</p>;
  }
  if (jobsStatus === "loading" || jobsStatus === "idle") {
    return <p className="text-sm text-fg-muted">Loading…</p>;
  }
  if (jobsStatus === "error") {
    return <p className="text-sm text-danger">Could not load crons.</p>;
  }

  const job = jobsData?.jobs?.find((j) => j.id === cronId);
  if (!job) return <p className="text-sm text-fg-muted">Cron not found.</p>;

  const runs = (runsData?.entries ?? []).filter((r) => r.jobId === cronId);
  const badge = cronStatusBadge(job);

  async function handleRunNow() {
    if (!client) return;
    setRunning(true);
    setRunError(null);
    try {
      await client.request("cron.run", { id: cronId, mode: "force" });
      // Give the gateway a beat to dispatch, then refetch.
      setTimeout(() => {
        refetchJobs();
        refetchRuns();
      }, 800);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to trigger");
    } finally {
      setRunning(false);
    }
  }

  async function handleTogglePause() {
    if (!client || !job) return;
    setActionError(null);
    setToggling(true);
    try {
      await client.request("cron.update", { id: cronId, enabled: !job.enabled });
      refetchJobs();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to toggle pause");
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!client) return;
    if (!confirm(`Delete cron "${job?.name || cronId}"? This cannot be undone.`)) return;
    setActionError(null);
    setDeleting(true);
    try {
      await client.request("cron.remove", { id: cronId });
      router.push(listHref);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  async function handleSaveSchedule(patch: SchedulePatch) {
    if (!client) throw new Error("Not connected");
    await client.request("cron.update", { id: cronId, schedule: patch });
    setEditorOpen(false);
    refetchJobs();
  }

  const message = job.payload?.message ?? job.prompt ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{job.name || "Untitled"}</h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[badge.tone]}`}
            >
              {badge.label}
            </span>
          </div>
          {job.description ? (
            <p className="mt-1 text-sm text-fg-muted">{job.description}</p>
          ) : null}
          <p className="mt-1 font-mono text-xs text-fg-subtle">{job.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleRunNow} disabled={running} variant="secondary">
            {running ? "Triggering…" : "Run now"}
          </Button>
          <Button
            onClick={handleTogglePause}
            disabled={toggling || deleting}
            variant="ghost"
          >
            {toggling ? "…" : job.enabled ? "Pause" : "Resume"}
          </Button>
          <Button onClick={() => setEditorOpen(true)} disabled={deleting} variant="ghost">
            Edit schedule
          </Button>
          <Button onClick={handleDelete} disabled={deleting} variant="ghost">
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>

      {runError ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {runError}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      {editorOpen ? (
        <CronScheduleEditor
          job={job}
          onSave={handleSaveSchedule}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}

      <section className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-bg-subtle p-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-fg-subtle">Schedule</div>
          <div className="mt-1 font-mono">{humanFrequency(job)}</div>
          {job.schedule?.tz ? (
            <div className="mt-0.5 text-xs text-fg-subtle">{job.schedule.tz}</div>
          ) : null}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-fg-subtle">Agent</div>
          <div className="mt-1">{job.agentId ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-fg-subtle">Last run</div>
          <div className="mt-1">{relTime(job.state?.lastRunAtMs)}</div>
          {job.state?.lastRunStatus ? (
            <div className="mt-0.5 text-xs text-fg-subtle">{job.state.lastRunStatus}</div>
          ) : null}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-fg-subtle">Next run</div>
          <div className="mt-1">{relTime(job.state?.nextRunAtMs)}</div>
        </div>
      </section>

      {message ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Prompt</h3>
          <pre className="rounded-lg border border-border bg-bg-subtle p-4 text-sm whitespace-pre-wrap text-fg">
            {message}
          </pre>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Recent runs</h3>
        {runsStatus === "loading" ? (
          <p className="text-sm text-fg-muted">Loading runs…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-fg-muted">No runs yet.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-subtle">
            {runs.map((r, i) => (
              <li key={`${r.ts}-${i}`} className="grid grid-cols-[auto_auto_1fr_auto] gap-3 p-3 text-sm">
                <span className="font-mono text-xs text-fg-muted">
                  {new Date(r.runAtMs ?? r.ts).toLocaleString()}
                </span>
                <span
                  className={`text-xs font-medium ${
                    r.status === "succeeded"
                      ? "text-accent"
                      : r.status === "failed" || r.status === "error"
                        ? "text-danger"
                        : "text-fg-muted"
                  }`}
                >
                  {r.status ?? "—"}
                </span>
                <span className="truncate text-xs text-fg-muted">
                  {r.error ?? r.summary ?? ""}
                </span>
                <span className="text-xs text-fg-subtle">
                  {r.durationMs ? `${Math.round(r.durationMs / 1000)}s` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
