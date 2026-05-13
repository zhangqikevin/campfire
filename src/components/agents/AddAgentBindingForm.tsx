"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  createBindingAction,
  markBindingVerifiedAction,
  type CreateBindingResult,
} from "@/lib/agent-bindings/actions";
import { saveToken } from "@/lib/agent-bindings/token-store";
import { verifyOpenClawReachable } from "@/lib/agent-bindings/verify";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

type FieldErrors = Extract<CreateBindingResult, { ok: false }>["errors"];

export function AddAgentBindingForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [progressTone, setProgressTone] = useState<"info" | "ok" | "warn">("info");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const url = String(fd.get("url") ?? "").trim();
    const token = String(fd.get("token") ?? "");

    setErrors({});
    setProgress(null);
    setSubmitting(true);

    try {
      if (!token.trim()) {
        setErrors({ form: ["Token is required"] });
        return;
      }

      setProgressTone("info");
      setProgress("Creating binding…");
      const result = await createBindingAction({ name, url, kind: "openclaw" });
      if (!result.ok) {
        setErrors(result.errors);
        setProgress(null);
        return;
      }

      setProgress("Saving token in this browser only…");
      try {
        await saveToken(result.bindingId, token);
      } catch (err) {
        setProgressTone("warn");
        setProgress(
          err instanceof Error
            ? `Could not save token locally: ${err.message}`
            : "Could not save token locally",
        );
        return;
      }

      setProgress("Probing the gateway…");
      const verify = await verifyOpenClawReachable(url);
      if (verify.ok) {
        await markBindingVerifiedAction(result.bindingId);
        setProgressTone("ok");
        setProgress(
          verify.sawChallenge
            ? "Verified: gateway responded with a challenge."
            : "Reachable: socket opened (no challenge frame seen).",
        );
      } else {
        setProgressTone("warn");
        setProgress(`Saved, but unreachable: ${verify.reason}`);
      }

      form.reset();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const toneClass =
    progressTone === "ok"
      ? "text-accent"
      : progressTone === "warn"
        ? "text-danger"
        : "text-fg-muted";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="binding-name">Name</Label>
        <Input
          id="binding-name"
          name="name"
          required
          maxLength={80}
          placeholder="My laptop's OpenClaw"
          invalid={!!errors.name}
          disabled={submitting}
          aria-describedby="name-error"
        />
        <FormError errors={errors.name} id="name-error" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="binding-url">Gateway URL</Label>
        <Input
          id="binding-url"
          name="url"
          type="url"
          required
          placeholder="ws://localhost:18789"
          invalid={!!errors.url}
          disabled={submitting}
          aria-describedby="url-help url-error"
        />
        <p id="url-help" className="text-xs text-fg-subtle">
          From <code className="font-mono">openclaw os url</code> (or paste the <code>ws://</code> URL of your gateway).
        </p>
        <FormError errors={errors.url} id="url-error" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="binding-token">Token</Label>
        <Input
          id="binding-token"
          name="token"
          type="password"
          required
          autoComplete="off"
          placeholder="From ~/.openclaw/openclaw.json → gateway.auth.token"
          disabled={submitting}
          aria-describedby="token-help"
        />
        <p id="token-help" className="text-xs text-fg-subtle">
          Stays in this browser&apos;s IndexedDB. Campfire&apos;s server never sees it.
        </p>
      </div>

      <FormError errors={errors.form} />

      {progress ? <p className={`text-sm ${toneClass}`}>{progress}</p> : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Working…" : "Bind agent"}
      </Button>
    </form>
  );
}
