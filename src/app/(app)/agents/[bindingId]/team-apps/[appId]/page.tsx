import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamAppDetailView } from "@/components/apps/TeamAppDetailView";
import { getTeamAppForMember } from "@/lib/team-apps/actions";

interface PageProps {
  params: Promise<{ bindingId: string; appId: string }>;
}

export default async function TeamAppPage({ params }: PageProps) {
  const { bindingId, appId } = await params;
  const app = await getTeamAppForMember(appId);
  if (!app) notFound();

  // SessionKey scopes the gateway's per-app SQLite/tool state. Including
  // bindingId+appId keeps each account's data for this Team App isolated
  // from any other account or other Team App on the same gateway.
  const sessionKey = `team-app:${bindingId}:${appId}`;

  return (
    <div className="space-y-4">
      <Link
        href={`/agents/${bindingId}/apps`}
        className="text-xs text-fg-muted hover:text-fg"
      >
        ← Apps
      </Link>
      <TeamAppDetailView
        app={{
          id: app.id,
          title: app.title,
          description: app.description,
          content: app.content,
        }}
        sessionKey={sessionKey}
      />
    </div>
  );
}
