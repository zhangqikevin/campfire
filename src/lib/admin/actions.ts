"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, normalizeEmail } from "@/lib/auth/password";
import { encryptToken } from "@/lib/auth/encryption";
import { requireAdmin } from "@/lib/auth/session";
import { createAccountSchema } from "@/lib/admin/schemas";
import { db } from "@/lib/db";
import { agentBindings, tenants, users, type UserRole } from "@/lib/db/schema";

export type CreateAccountFormState = {
  ok: boolean;
  errors?: Partial<
    Record<
      "email" | "password" | "role" | "bindingName" | "bindingUrl" | "bindingToken" | "form",
      string[]
    >
  >;
};

const INITIAL: CreateAccountFormState = { ok: false };

function fieldErrors(
  flat: { fieldErrors: Record<string, string[] | undefined> },
): CreateAccountFormState["errors"] {
  const errs: CreateAccountFormState["errors"] = {};
  const keys = ["email", "password", "role", "bindingName", "bindingUrl", "bindingToken"] as const;
  for (const k of keys) {
    const v = flat.fieldErrors[k];
    if (v?.length) errs[k] = v;
  }
  return errs;
}

export async function createAccountAction(
  _prev: CreateAccountFormState,
  formData: FormData,
): Promise<CreateAccountFormState> {
  await requireAdmin();

  const parsed = createAccountSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    bindingName: formData.get("bindingName"),
    bindingKind: formData.get("bindingKind") ?? "openclaw",
    bindingUrl: formData.get("bindingUrl"),
    bindingToken: formData.get("bindingToken"),
  });

  if (!parsed.success) {
    return { ...INITIAL, errors: fieldErrors(parsed.error.flatten()) };
  }

  const data = parsed.data;
  const emailNorm = normalizeEmail(data.email);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailNormalized, emailNorm))
    .limit(1);
  if (existing) {
    return { ok: false, errors: { email: ["An account with this email already exists"] } };
  }

  const passwordHash = await hashPassword(data.password);
  const enc = encryptToken(data.bindingToken);

  await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: emailNorm })
      .returning({ id: tenants.id });
    if (!tenant) throw new Error("Failed to create tenant");

    const [user] = await tx
      .insert(users)
      .values({
        email: data.email,
        emailNormalized: emailNorm,
        passwordHash,
        tenantId: tenant.id,
        role: data.role as UserRole,
      })
      .returning({ id: users.id });
    if (!user) throw new Error("Failed to create user");

    await tx.insert(agentBindings).values({
      tenantId: tenant.id,
      name: data.bindingName,
      kind: data.bindingKind,
      url: data.bindingUrl,
      tokenCiphertext: enc.ciphertext,
      tokenNonce: enc.nonce,
      tokenProvisionedAt: new Date(),
    });
  });

  revalidatePath("/admin/accounts");
  redirect("/admin/accounts");
}

export interface AdminAccountRow {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
  bindingName: string | null;
  bindingUrl: string | null;
  bindingProvisionedAt: Date | null;
  createdAt: Date;
}

export async function listAccountsForAdmin(): Promise<AdminAccountRow[]> {
  await requireAdmin();

  // Each account has exactly one binding (admin-provisioned at account
  // creation). If a future account has zero or multiple, we surface the
  // first; admin can dig deeper from the detail page later.
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      role: users.role,
      tenantId: users.tenantId,
      bindingName: agentBindings.name,
      bindingUrl: agentBindings.url,
      bindingProvisionedAt: agentBindings.tokenProvisionedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(agentBindings, eq(agentBindings.tenantId, users.tenantId))
    .orderBy(users.createdAt);

  return rows.map((r) => ({
    userId: r.userId,
    email: r.email,
    role: r.role,
    tenantId: r.tenantId,
    bindingName: r.bindingName,
    bindingUrl: r.bindingUrl,
    bindingProvisionedAt: r.bindingProvisionedAt,
    createdAt: r.createdAt,
  }));
}
