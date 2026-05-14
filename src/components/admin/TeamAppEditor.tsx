"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createTeamAppAction,
  deleteTeamAppAction,
  updateTeamAppAction,
  type TeamAppFormState,
} from "@/lib/team-apps/actions";
import type { LintFinding } from "@/lib/lint/lint-openui";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const INITIAL: TeamAppFormState = { ok: false };

interface TeamAppEditorProps {
  mode: "create" | "edit";
  initial?: {
    id: string;
    title: string;
    description: string | null;
    content: string;
    enabled: boolean;
  };
}

export function TeamAppEditor({ mode, initial }: TeamAppEditorProps) {
  const action = mode === "create" ? createTeamAppAction : updateTeamAppAction;
  const [state, formAction, isPending] = useActionState(action, INITIAL);
  const [confirming, setConfirming] = useState(false);

  const titleValue = state.values?.title ?? initial?.title ?? "";
  const descriptionValue = state.values?.description ?? initial?.description ?? "";
  const contentValue = state.values?.content ?? initial?.content ?? "";
  const enabledValue = state.values?.enabled ?? initial?.enabled ?? true;

  async function handleDelete() {
    if (!initial) return;
    if (!confirm(`Delete Team App "${initial.title}"? This cannot be undone.`)) return;
    setConfirming(true);
    try {
      await deleteTeamAppAction(initial.id);
      window.location.href = "/admin/team-apps";
    } finally {
      setConfirming(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {mode === "edit" && initial ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          type="text"
          defaultValue={titleValue}
          required
          maxLength={120}
          invalid={!!state.errors?.title}
        />
        <FormError errors={state.errors?.title} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          name="description"
          type="text"
          defaultValue={descriptionValue}
          maxLength={500}
          invalid={!!state.errors?.description}
        />
        <FormError errors={state.errors?.description} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="content">OpenUI Lang source</Label>
        <textarea
          id="content"
          name="content"
          defaultValue={contentValue}
          required
          rows={20}
          spellCheck={false}
          className={`block w-full rounded-md border ${
            state.errors?.content ? "border-danger" : "border-border"
          } bg-bg p-3 font-mono text-xs text-fg`}
        />
        <FormError errors={state.errors?.content} />
        <p className="text-xs text-fg-subtle">
          Linted server-side on save. Findings appear below — the app still saves so you can
          iterate, but renders may misbehave until findings are clear.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="enabled"
          name="enabled"
          type="checkbox"
          defaultChecked={enabledValue}
          className="h-4 w-4 rounded border-border bg-bg"
        />
        <Label htmlFor="enabled">Enabled (visible to all accounts)</Label>
      </div>

      {state.lint ? <LintReportView lint={state.lint} /> : null}

      <FormError errors={state.errors?.form} />

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          {mode === "edit" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={confirming || isPending}
            >
              {confirming ? "Deleting…" : "Delete"}
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/team-apps">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : mode === "create" ? "Create Team App" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function LintReportView({ lint }: { lint: { ok: boolean; findings: LintFinding[]; summary: string; hint?: string } }) {
  if (lint.ok && lint.findings.length === 0) {
    return (
      <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-sm">
        <p className="text-accent">Lint clean: no findings.</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm">
      <p className="font-medium text-danger">{lint.findings.length} lint finding{lint.findings.length === 1 ? "" : "s"}</p>
      <ul className="mt-2 space-y-2">
        {lint.findings.map((f, i) => (
          <li key={i} className="rounded border border-danger/30 bg-bg-subtle p-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-fg-muted">{f.code}</span>
              {f.statement ? (
                <span className="font-mono text-xs text-fg-subtle">@{f.statement}</span>
              ) : null}
            </div>
            <p className="mt-1 text-fg">{f.message}</p>
            {f.hint ? <p className="mt-1 text-xs text-fg-muted">{f.hint}</p> : null}
          </li>
        ))}
      </ul>
      {lint.hint ? <p className="mt-3 text-xs text-fg-muted">{lint.hint}</p> : null}
    </div>
  );
}
