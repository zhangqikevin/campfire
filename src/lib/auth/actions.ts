"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { loginSchema } from "@/lib/auth/schemas";

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
