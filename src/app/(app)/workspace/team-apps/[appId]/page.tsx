import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamAppDetailView } from "@/components/apps/TeamAppDetailView";
import { getPrimaryBindingForCurrentUser } from "@/lib/agent-bindings/server";
import { getTeamAppForMember } from "@/lib/team-apps/actions";

interface PageProps {
  params: Promise<{ appId: string }>;
}

export default async function WorkspaceTeamAppPage({ params }: PageProps) {
  const { appId } = await params;
  const [binding, app] = await Promise.all([
    getPrimaryBindingForCurrentUser(),
    getTeamAppForMember(appId),
  ]);
  if (!binding || !app) notFound();

  const sessionKey = `team-app:${binding.id}:${app.id}`;

  return (
    <div className="space-y-4">
      <Link href="/workspace/apps" className="text-xs text-fg-muted hover:text-fg">
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
