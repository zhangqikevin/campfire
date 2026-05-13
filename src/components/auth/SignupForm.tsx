"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const INITIAL: AuthFormState = { ok: false };

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, INITIAL);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          invalid={!!state.errors?.email}
          aria-describedby="email-error"
        />
        <FormError errors={state.errors?.email} id="email-error" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          invalid={!!state.errors?.password}
          aria-describedby="password-error"
        />
        <FormError errors={state.errors?.password} id="password-error" />
        <p className="text-xs text-fg-subtle">At least 8 characters.</p>
      </div>

      <FormError errors={state.errors?.form} />

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-fg underline underline-offset-2">
          Log in
        </Link>
      </p>
    </form>
  );
}
