"use server";

import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { hashPassword, normalizeEmail } from "@/lib/auth/password";
import { loginSchema, signupSchema } from "@/lib/auth/schemas";
import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";

export type AuthFormState = {
  ok: boolean;
  errors?: Partial<Record<"email" | "password" | "form", string[]>>;
};

const INITIAL_STATE: AuthFormState = { ok: false };

function fieldErrors(zodFlattened: {
  fieldErrors: Record<string, string[] | undefined>;
}): AuthFormState["errors"] {
  const errors: AuthFormState["errors"] = {};
  if (zodFlattened.fieldErrors["email"]?.length) errors.email = zodFlattened.fieldErrors["email"];
  if (zodFlattened.fieldErrors["password"]?.length)
    errors.password = zodFlattened.fieldErrors["password"];
  return errors;
}

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ...INITIAL_STATE, errors: fieldErrors(parsed.error.flatten()) };
  }

  const { email, password } = parsed.data;
  const emailNormalized = normalizeEmail(email);

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.emailNormalized, emailNormalized))
    .limit(1);

  if (existing) {
    return { ok: false, errors: { email: ["An account with this email already exists"] } };
  }

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: emailNormalized })
      .returning({ id: tenants.id });

    if (!tenant) throw new Error("Failed to create tenant");

    await tx.insert(users).values({
      email,
      emailNormalized,
      passwordHash,
      tenantId: tenant.id,
    });
  });

  // signIn throws NEXT_REDIRECT on success — must bubble.
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, errors: { form: ["Account was created but sign-in failed. Try logging in."] } };
    }
    throw err;
  }

  return { ok: true };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ...INITIAL_STATE, errors: fieldErrors(parsed.error.flatten()) };
  }

  const redirectTo = (formData.get("redirectTo") as string | null) ?? "/dashboard";

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, errors: { form: ["Invalid email or password"] } };
    }
    throw err;
  }

  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
