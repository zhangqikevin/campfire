import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-bg-subtle">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-sm bg-accent" aria-hidden />
              <span className="text-sm font-semibold tracking-tight">Campfire</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/workspace"
                className="rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-bg-inset hover:text-fg"
              >
                Workspace
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-bg-inset hover:text-fg"
              >
                Dashboard
              </Link>
              <Link
                href="/agents"
                className="rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-bg-inset hover:text-fg"
              >
                Agents
              </Link>
              {session.user.role === "admin" ? (
                <Link
                  href="/admin"
                  className="rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-bg-inset hover:text-fg"
                >
                  Admin
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-fg-muted">{session.user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
