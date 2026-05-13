"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/auth/session";
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

export async function markBindingVerifiedAction(id: string): Promise<{ ok: boolean }> {
  const tenantId = await requireTenantId();
  await db
    .update(agentBindings)
    .set({ lastVerifiedAt: new Date() })
    .where(and(eq(agentBindings.id, id), eq(agentBindings.tenantId, tenantId)));
  revalidatePath("/agents");
  return { ok: true };
}
