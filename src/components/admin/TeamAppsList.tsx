import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { listTeamAppsForAdmin } from "@/lib/team-apps/actions";

export async function TeamAppsList() {
  const rows = await listTeamAppsForAdmin();

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm text-fg-muted">No Team Apps yet.</p>
        <p className="mt-1 text-xs text-fg-subtle">
          Team Apps are shared org-wide. Every account renders them against their own gateway.
        </p>
        <div className="mt-3">
          <Link href="/admin/team-apps/new">
            <Button variant="primary">Create the first Team App</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">
          {rows.length} Team App{rows.length === 1 ? "" : "s"}
        </p>
        <Link href="/admin/team-apps/new">
          <Button variant="primary">Create Team App</Button>
        </Link>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-subtle">
        {rows.map((app) => (
          <li key={app.id}>
            <Link
              href={`/admin/team-apps/${app.id}`}
              className="flex items-center justify-between p-4 hover:bg-bg-inset/60"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{app.title}</span>
                  {!app.enabled ? (
                    <span className="inline-flex items-center rounded-full bg-fg-subtle/15 px-2 py-0.5 text-xs font-medium text-fg-muted">
                      disabled
                    </span>
                  ) : null}
                </div>
                {app.description ? (
                  <div className="mt-0.5 truncate text-xs text-fg-subtle">{app.description}</div>
                ) : null}
                <div className="mt-0.5 text-xs text-fg-subtle">
                  Updated {new Date(app.updatedAt).toLocaleString()}
                </div>
              </div>
              <span className="font-mono text-xs text-fg-subtle">{app.id.slice(0, 8)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
