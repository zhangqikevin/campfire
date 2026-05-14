import Link from "next/link";
import { TeamAppEditor } from "@/components/admin/TeamAppEditor";

export const metadata = {
  title: "New Team App · Admin · Campfire",
};

export default function NewTeamAppPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/team-apps" className="text-xs text-fg-muted hover:text-fg">
        ← Team Apps
      </Link>
      <div>
        <h2 className="text-base font-semibold">Create Team App</h2>
        <p className="text-sm text-fg-muted">
          Saved as a template. Each account renders it against their own gateway, so data lives
          per-account.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-bg-subtle p-6">
        <TeamAppEditor mode="create" />
      </div>
    </div>
  );
}
