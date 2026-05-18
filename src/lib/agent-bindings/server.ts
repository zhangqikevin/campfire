import { cache } from "react";
import { eq } from "drizzle-orm";
import { requireTenantId } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { agentBindings, type AgentBinding } from "@/lib/db/schema";

/**
 * Resolve the current user's primary binding (oldest = the one admin
 * provisioned at account creation). React's `cache()` dedupes the DB hit
 * within one render pass so the workspace layout AND each child page can
 * both call this freely without N queries.
 *
 * Returns null when no binding exists yet — the workspace layout shows an
 * empty state in that case so the user can ask admin to provision one.
 */
export const getPrimaryBindingForCurrentUser = cache(
  async (): Promise<AgentBinding | null> => {
    const tenantId = await requireTenantId();
    const [row] = await db
      .select()
      .from(agentBindings)
      .where(eq(agentBindings.tenantId, tenantId))
      .orderBy(agentBindings.createdAt)
      .limit(1);
    return row ?? null;
  },
);
