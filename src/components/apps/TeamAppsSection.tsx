import Link from "next/link";
import { listTeamAppsForMember } from "@/lib/team-apps/actions";

interface TeamAppsSectionProps {
  bindingId: string;
}

export async function TeamAppsSection({ bindingId }: TeamAppsSectionProps) {
  const apps = await listTeamAppsForMember();
  if (apps.length === 0) return null;

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">Team Apps</h3>
        <p className="text-xs text-fg-subtle">
          Shared org-wide. Renders against this binding&apos;s gateway, so the data is yours.
        </p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-subtle">
        {apps.map((app) => (
          <li key={app.id}>
            <Link
              href={`/agents/${bindingId}/team-apps/${app.id}`}
              className="flex items-center justify-between p-4 hover:bg-bg-inset/60"
            >
              <div className="min-w-0">
                <div className="font-medium">{app.title}</div>
                {app.description ? (
                  <div className="mt-0.5 truncate text-xs text-fg-subtle">{app.description}</div>
                ) : null}
              </div>
              <span className="font-mono text-xs text-fg-subtle">team</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
