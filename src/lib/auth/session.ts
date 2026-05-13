import { redirect } from "next/navigation";
import { auth } from "@/auth";

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
