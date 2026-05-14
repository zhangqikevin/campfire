"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createAccountAction,
  type CreateAccountFormState,
} from "@/lib/admin/actions";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const INITIAL: CreateAccountFormState = { ok: false };

export function CreateAccountForm() {
  const [state, formAction, isPending] = useActionState(createAccountAction, INITIAL);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Account</h3>
          <p className="text-xs text-fg-muted">
            The user signs in with this email + initial password. They can change the password later.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
            invalid={!!state.errors?.email}
          />
          <FormError errors={state.errors?.email} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Initial password</Label>
          <Input
            id="password"
            name="password"
            type="text"
            autoComplete="off"
            required
            minLength={8}
            invalid={!!state.errors?.password}
          />
          <FormError errors={state.errors?.password} />
          <p className="text-xs text-fg-subtle">At least 8 characters. The user should change it on first login.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            defaultValue="member"
            className="block h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <FormError errors={state.errors?.role} />
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div>
          <h3 className="text-sm font-semibold">OpenClaw gateway binding</h3>
          <p className="text-xs text-fg-muted">
            The token is encrypted at rest and decrypted into this user&apos;s browser on their first login.
          </p>
        </div>
        <input type="hidden" name="bindingKind" value="openclaw" />
        <div className="space-y-1.5">
          <Label htmlFor="bindingName">Binding name</Label>
          <Input
            id="bindingName"
            name="bindingName"
            type="text"
            defaultValue="My gateway"
            required
            invalid={!!state.errors?.bindingName}
          />
          <FormError errors={state.errors?.bindingName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bindingUrl">Gateway URL</Label>
          <Input
            id="bindingUrl"
            name="bindingUrl"
            type="text"
            placeholder="ws://localhost:18789  or  wss://pods.example.com/oc/<name>"
            required
            invalid={!!state.errors?.bindingUrl}
          />
          <FormError errors={state.errors?.bindingUrl} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bindingToken">Gateway token</Label>
          <Input
            id="bindingToken"
            name="bindingToken"
            type="text"
            autoComplete="off"
            required
            invalid={!!state.errors?.bindingToken}
          />
          <FormError errors={state.errors?.bindingToken} />
          <p className="text-xs text-fg-subtle">
            Find it in <code className="font-mono">~/.openclaw/openclaw.json</code> on the gateway host, at <code className="font-mono">gateway.auth.token</code>.
          </p>
        </div>
      </section>

      <FormError errors={state.errors?.form} />

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Link href="/admin/accounts">
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Creating…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}
