"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const INITIAL: AuthFormState = { ok: false };

interface LoginFormProps {
  redirectTo?: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

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
          autoComplete="current-password"
          required
          invalid={!!state.errors?.password}
          aria-describedby="password-error"
        />
        <FormError errors={state.errors?.password} id="password-error" />
      </div>

      <FormError errors={state.errors?.form} />

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Logging in…" : "Log in"}
      </Button>

      <p className="text-center text-sm text-fg-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-fg underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </form>
  );
}
