"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteBindingAction } from "@/lib/agent-bindings/actions";
import { deleteToken } from "@/lib/agent-bindings/token-store";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/agents/StatusBadge";
import type { AgentBinding } from "@/lib/db/schema";

interface BindingsListProps {
  bindings: AgentBinding[];
}

function formatVerifiedAt(date: Date | null): string {
  if (!date) return "Never verified";
  return `Last verified ${date.toLocaleString()}`;
}

export function BindingsList({ bindings }: BindingsListProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete binding "${name}"? Its token will also be removed from this browser.`)) {
      return;
    }
    setPendingId(id);
    try {
      // Best-effort: clear browser token before the server row goes. If the
      // server delete fails, the next render will still show the binding —
      // user can retry, and the (orphaned) token re-saves on retry.
      try {
        await deleteToken(id);
      } catch {
        // ignore — IDB might be blocked; the server delete is what matters
      }
      await deleteBindingAction(id);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  if (bindings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-sm text-fg-muted">
        No bindings yet. Add one above to get started.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-subtle">
      {bindings.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-4 p-4">
          <Link
            href={`/agents/${b.id}`}
            className="-m-2 min-w-0 flex-1 rounded-md p-2 hover:bg-bg-inset/60"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{b.name}</span>
              <StatusBadge
                verified={!!b.lastVerifiedAt}
                title={formatVerifiedAt(b.lastVerifiedAt)}
              />
            </div>
            <div className="mt-1 truncate text-sm text-fg-muted">
              <span className="font-mono">{b.url}</span>
              <span className="px-2">·</span>
              <span>{b.kind}</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            onClick={() => handleDelete(b.id, b.name)}
            disabled={pendingId === b.id}
          >
            {pendingId === b.id ? "Deleting…" : "Delete"}
          </Button>
        </li>
      ))}
    </ul>
  );
}
