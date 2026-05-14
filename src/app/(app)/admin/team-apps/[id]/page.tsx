import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamAppEditor } from "@/components/admin/TeamAppEditor";
import { getTeamAppForAdmin } from "@/lib/team-apps/actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTeamAppPage({ params }: PageProps) {
  const { id } = await params;
  const app = await getTeamAppForAdmin(id);
  if (!app) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/team-apps" className="text-xs text-fg-muted hover:text-fg">
        ← Team Apps
      </Link>
      <div>
        <h2 className="text-base font-semibold">{app.title}</h2>
        <p className="font-mono text-xs text-fg-subtle">{app.id}</p>
      </div>
      <div className="rounded-lg border border-border bg-bg-subtle p-6">
        <TeamAppEditor
          mode="edit"
          initial={{
            id: app.id,
            title: app.title,
            description: app.description,
            content: app.content,
            enabled: app.enabled,
          }}
        />
      </div>
    </div>
  );
}
