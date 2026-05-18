"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { CronJobRecord } from "@/lib/cron";

export type ScheduleKind = "cron" | "interval";

export interface SchedulePatch {
  kind: ScheduleKind;
  expr?: string;
  everyMs?: number;
  tz?: string;
}

interface CronScheduleEditorProps {
  job: CronJobRecord;
  /** Returns a Promise so the dialog can show "Saving…" while it resolves. */
  onSave: (patch: SchedulePatch) => Promise<void>;
  onClose: () => void;
}

const MINUTE_MS = 60_000;

function inferInitial(job: CronJobRecord): {
  kind: ScheduleKind;
  expr: string;
  everyMin: string;
  tz: string;
} {
  const s = job.schedule;
  if (s?.kind === "cron" && s.expr) {
    return { kind: "cron", expr: s.expr, everyMin: "5", tz: s.tz ?? "" };
  }
  if ((s?.kind === "interval" || s?.kind === "every") && s.everyMs) {
    return {
      kind: "interval",
      expr: "0 9 * * *",
      everyMin: String(Math.max(1, Math.round(s.everyMs / MINUTE_MS))),
      tz: s.tz ?? "",
    };
  }
  return { kind: "cron", expr: "0 9 * * *", everyMin: "5", tz: "" };
}

export function CronScheduleEditor({ job, onSave, onClose }: CronScheduleEditorProps) {
  const initial = inferInitial(job);
  const [kind, setKind] = useState<ScheduleKind>(initial.kind);
  const [expr, setExpr] = useState(initial.expr);
  const [everyMin, setEveryMin] = useState(initial.everyMin);
  const [tz, setTz] = useState(initial.tz);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);

    let patch: SchedulePatch;
    if (kind === "cron") {
      const trimmed = expr.trim();
      if (!trimmed) {
        setError("Cron expression is required.");
        return;
      }
      patch = { kind: "cron", expr: trimmed, ...(tz.trim() ? { tz: tz.trim() } : {}) };
    } else {
      const n = Number(everyMin);
      if (!Number.isFinite(n) || n <= 0) {
        setError("Interval must be a positive number of minutes.");
        return;
      }
      patch = { kind: "interval", everyMs: Math.round(n * MINUTE_MS) };
    }

    setSaving(true);
    try {
      await onSave(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !saving && onClose()}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-bg-subtle p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cron-edit-title"
      >
        <h2 id="cron-edit-title" className="text-base font-semibold">
          Edit schedule
        </h2>
        <p className="mt-1 text-sm text-fg-muted">
          Update when this cron fires. The new schedule takes effect immediately.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind("cron")}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                kind === "cron"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-fg-muted hover:text-fg"
              }`}
            >
              Cron expression
            </button>
            <button
              type="button"
              onClick={() => setKind("interval")}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium ${
                kind === "interval"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-fg-muted hover:text-fg"
              }`}
            >
              Every N minutes
            </button>
          </div>

          {kind === "cron" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="cron-expr">Cron expression</Label>
                <Input
                  id="cron-expr"
                  type="text"
                  autoFocus
                  value={expr}
                  onChange={(e) => setExpr(e.target.value)}
                  placeholder="0 9 * * *"
                  className="font-mono"
                />
                <p className="text-xs text-fg-subtle">
                  Five fields: minute hour day-of-month month day-of-week. Example:{" "}
                  <code className="font-mono">0 9 * * *</code> → 09:00 daily.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cron-tz">Timezone (optional)</Label>
                <Input
                  id="cron-tz"
                  type="text"
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  placeholder="America/Los_Angeles"
                />
                <p className="text-xs text-fg-subtle">
                  IANA name. Leave blank to use the gateway&apos;s default.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="cron-every">Every</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cron-every"
                  type="number"
                  autoFocus
                  min={1}
                  value={everyMin}
                  onChange={(e) => setEveryMin(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-fg-muted">minutes</span>
              </div>
            </div>
          )}

          {error ? (
            <p className="rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving…" : "Save schedule"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
