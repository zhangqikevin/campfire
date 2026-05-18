import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = {
  title: "Admin · Campfire",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Layer-2 admin gate (middleware authorized() is layer 1). DB re-check
  // catches a freshly-demoted admin whose JWT still says admin.
  await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Manage organization accounts and shared Team Apps.
        </p>
      </header>
      <AdminNav />
      <div>{children}</div>
    </div>
  );
}
