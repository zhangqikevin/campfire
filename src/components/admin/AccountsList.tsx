import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { listAccountsForAdmin } from "@/lib/admin/actions";

export async function AccountsList() {
  const rows = await listAccountsForAdmin();

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm text-fg-muted">No accounts yet.</p>
        <div className="mt-3">
          <Link href="/admin/accounts/new">
            <Button variant="primary">Create the first account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">{rows.length} account{rows.length === 1 ? "" : "s"}</p>
        <Link href="/admin/accounts/new">
          <Button variant="primary">Create account</Button>
        </Link>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-subtle">
        {rows.map((r) => (
          <li key={r.userId} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.email}</span>
                {r.role === "admin" ? (
                  <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    admin
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-xs text-fg-subtle">
                Joined {new Date(r.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="truncate text-sm text-fg-muted">
                {r.bindingName ?? <span className="italic">no binding</span>}
              </div>
              <div className="truncate font-mono text-xs text-fg-subtle">{r.bindingUrl ?? "—"}</div>
            </div>
            <span className="text-xs text-fg-subtle">
              {r.bindingProvisionedAt
                ? `provisioned ${new Date(r.bindingProvisionedAt).toLocaleDateString()}`
                : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
