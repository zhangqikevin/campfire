import { TeamAppsList } from "@/components/admin/TeamAppsList";

export const metadata = {
  title: "Team Apps · Admin · Campfire",
};

export default async function TeamAppsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Team Apps</h2>
        <p className="text-sm text-fg-muted">
          Shared OpenUI Lang programs. Every account sees them in their Apps tab and renders them
          against their own gateway.
        </p>
      </div>
      <TeamAppsList />
    </div>
  );
}
