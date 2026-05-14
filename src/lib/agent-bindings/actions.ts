"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/auth/session";
import { decryptToken } from "@/lib/auth/encryption";
import { createBindingSchema, type CreateBindingInput } from "@/lib/agent-bindings/schemas";
import { db } from "@/lib/db";
import { agentBindings, type AgentBinding } from "@/lib/db/schema";

export type CreateBindingResult =
  | { ok: true; bindingId: string }
  | { ok: false; errors: Partial<Record<"name" | "url" | "kind" | "form", string[]>> };

export async function createBindingAction(
  input: CreateBindingInput,
): Promise<CreateBindingResult> {
  const parsed = createBindingSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      errors: {
        ...(flat.name?.length ? { name: flat.name } : {}),
        ...(flat.url?.length ? { url: flat.url } : {}),
        ...(flat.kind?.length ? { kind: flat.kind } : {}),
      },
    };
  }

  const tenantId = await requireTenantId();

  const [row] = await db
    .insert(agentBindings)
    .values({
      tenantId,
      name: parsed.data.name,
      url: parsed.data.url,
      kind: parsed.data.kind,
    })
    .returning({ id: agentBindings.id });

  if (!row) {
    return { ok: false, errors: { form: ["Failed to create binding"] } };
  }

  revalidatePath("/agents");
  return { ok: true, bindingId: row.id };
}

export async function listBindingsForTenant(): Promise<AgentBinding[]> {
  const tenantId = await requireTenantId();
  return db
    .select()
    .from(agentBindings)
    .where(eq(agentBindings.tenantId, tenantId))
    .orderBy(desc(agentBindings.createdAt));
}

export async function getBindingForTenant(id: string): Promise<AgentBinding | null> {
  const tenantId = await requireTenantId();
  const [row] = await db
    .select()
    .from(agentBindings)
    .where(and(eq(agentBindings.id, id), eq(agentBindings.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function deleteBindingAction(id: string): Promise<{ ok: boolean }> {
  const tenantId = await requireTenantId();
  await db
    .delete(agentBindings)
    .where(and(eq(agentBindings.id, id), eq(agentBindings.tenantId, tenantId)));
  revalidatePath("/agents");
  return { ok: true };
}

/**
 * First-login activation: hand the admin-provisioned token (encrypted at rest)
 * to the user's browser exactly when their IDB is empty. The server keeps the
 * ciphertext on the row so the same user can re-fetch on a different browser
 * or after clearing storage — the trust model is that any authenticated owner
 * of this tenant already controls the underlying gateway.
 */
export async function getProvisionedToken(
  bindingId: string,
): Promise<{ ok: true; token: string } | { ok: false; reason: "not_found" | "not_provisioned" }> {
  const tenantId = await requireTenantId();
  const [row] = await db
    .select({
      tokenCiphertext: agentBindings.tokenCiphertext,
      tokenNonce: agentBindings.tokenNonce,
    })
    .from(agentBindings)
    .where(and(eq(agentBindings.id, bindingId), eq(agentBindings.tenantId, tenantId)))
    .limit(1);

  if (!row) return { ok: false, reason: "not_found" };
  if (!row.tokenCiphertext || !row.tokenNonce) {
    return { ok: false, reason: "not_provisioned" };
  }

  const token = decryptToken({ ciphertext: row.tokenCiphertext, nonce: row.tokenNonce });
  return { ok: true, token };
}

export async function markBindingVerifiedAction(id: string): Promise<{ ok: boolean }> {
  const tenantId = await requireTenantId();
  await db
    .update(agentBindings)
    .set({ lastVerifiedAt: new Date() })
    .where(and(eq(agentBindings.id, id), eq(agentBindings.tenantId, tenantId)));
  revalidatePath("/agents");
  return { ok: true };
}
