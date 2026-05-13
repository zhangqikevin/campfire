// Cron data shapes returned by OpenClaw's gateway-native cron.* RPCs.
// Ported verbatim from thesysdev/openclaw-os/packages/claw-client/src/lib/cron.ts
// (MIT). The shapes are the wire contract with the openclaw gateway, not our
// invention — copying lets cron.list / cron.runs responses typecheck without
// re-deriving the types.

export type CronJobRecord = {
  id: string;
  name: string;
  description?: string;
  /** Top-level prompt some gateway versions populate. The actual cron-job
   *  prompt is normally inside `payload.message` — UI reads from payload
   *  first, then falls back to these. */
  prompt?: string;
  agentId?: string;
  enabled: boolean;
  sessionKey?: string;
  threadId?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  schedule?: {
    kind: string;
    at?: string;
    everyMs?: number;
    expr?: string;
    tz?: string;
  };
  /** Where openclaw stores the agent prompt for a cron job. The job is
   *  invoked as an "agentTurn" with this text. */
  payload?: {
    kind?: string;
    message?: string;
    timeoutSeconds?: number;
  };
  state?: {
    nextRunAtMs?: number;
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastError?: string;
    lastDurationMs?: number;
    consecutiveErrors?: number;
    lastDeliveryStatus?: string;
  };
};

export type CronRunEntry = {
  ts: number;
  jobId: string;
  jobName?: string;
  status?: string;
  error?: string;
  summary?: string;
  delivered?: boolean;
  deliveryStatus?: string;
  deliveryError?: string;
  sessionId?: string;
  sessionKey?: string;
  threadId?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
  model?: string;
  provider?: string;
};

export type CronStatusRecord = Record<string, unknown>;

// ── Formatting helpers ───────────────────────────────────────────────────

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function humanFrequency(job: CronJobRecord): string {
  const s = job.schedule;
  if (!s) return "Manual";
  if (s.kind === "cron" && s.expr) return s.expr;
  // 2026.4 used `kind: "interval"` with `everyMs`; 2026.5 sometimes ships
  // interval jobs as `kind: "every"`. Render the duration when we know it,
  // and a friendly fallback when we don't — never the raw kind.
  if ((s.kind === "interval" || s.kind === "every") && s.everyMs) {
    const ms = s.everyMs;
    if (ms < HOUR_MS) return `Every ${Math.round(ms / MINUTE_MS)} min`;
    if (ms < DAY_MS) return `Every ${Math.round(ms / HOUR_MS)} h`;
    return `Every ${Math.round(ms / DAY_MS)} d`;
  }
  if (s.kind === "every" || s.kind === "interval") return "Recurring";
  return s.kind || "Manual";
}

export function relTime(ms: number | undefined): string {
  if (!ms) return "—";
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < MINUTE_MS) return past ? "just now" : "in <1 min";
  if (abs < HOUR_MS) {
    const m = Math.round(abs / MINUTE_MS);
    return past ? `${m} min ago` : `in ${m} min`;
  }
  if (abs < DAY_MS) {
    const h = Math.round(abs / HOUR_MS);
    return past ? `${h} h ago` : `in ${h} h`;
  }
  const d = Math.round(abs / DAY_MS);
  return past ? `${d} d ago` : `in ${d} d`;
}

export function cronStatusBadge(job: CronJobRecord): {
  label: string;
  tone: "ok" | "warn" | "muted" | "danger";
} {
  if (!job.enabled) return { label: "Paused", tone: "muted" };
  const last = job.state?.lastRunStatus;
  if (last === "succeeded") return { label: "OK", tone: "ok" };
  if (last === "failed" || last === "error") return { label: "Failed", tone: "danger" };
  if (last === "running") return { label: "Running", tone: "warn" };
  return { label: "Enabled", tone: "ok" };
}
