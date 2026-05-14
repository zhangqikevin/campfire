import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";

/**
 * Resolves the current tenant id from the session, or redirects to /login if
 * there isn't one. Every server-action / RPC that touches tenant-scoped data
 * MUST go through this — it's the single chokepoint that turns "logged in"
 * into "scoped to my data", and it makes accidental cross-tenant reads
 * structurally harder.
 *
 * Uses next/navigation's `redirect()` (which throws NEXT_REDIRECT) instead of
 * a plain throw so an unauthenticated caller gets a clean 307 to /login rather
 * than a 500 error page. Middleware should catch most unauth requests upstream;
 * this is defense in depth for the cases it doesn't.
 */
export async function requireTenantId(): Promise<string> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    redirect("/login");
  }
  return tenantId;
}

/**
 * Resolves the current user id, or redirects to /login. Use for reads that
 * are org-wide (e.g. Team Apps) — they need an authenticated caller but no
 * tenant scope.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login");
  }
  return userId;
}

export interface AdminSession {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
}

/**
 * Resolves the current admin user, or redirects.
 *
 * Two-layer check by design:
 *   - JWT carries the role for fast middleware decisions (Auth.js's
 *     authorized() callback already 302's a non-admin away from /admin/*).
 *   - We re-fetch the user's role from the DB here for server actions /
 *     pages that mutate admin-scoped data. JWTs don't auto-invalidate on
 *     demote — without a DB cross-check a freshly-demoted admin would
 *     keep admin powers until their token expired.
 *
 * Returns the full admin context so callers don't need a second DB hit.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await auth();
  const userId = session?.user?.id;
  const tenantId = session?.user?.tenantId;
  const email = session?.user?.email ?? "";

  if (!userId || !tenantId) {
    redirect("/login");
  }

  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || row.role !== "admin") {
    redirect("/dashboard");
  }

  return { userId, tenantId, email, role: row.role };
}
