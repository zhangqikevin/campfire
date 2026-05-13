"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveToken } from "@/lib/agent-bindings/token-store";

export const dynamic = "force-static";

type Status = "configuring" | "error";

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("configuring");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    void (async () => {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        setStatus("error");
        setErrorMsg(
          "No token found in this URL. Run `openclaw campfire url` and open the link it prints.",
        );
        return;
      }

      const params = new URLSearchParams(hash);
      const token = params.get("token");
      if (!token) {
        setStatus("error");
        setErrorMsg("Token missing from the setup link.");
        return;
      }

      try {
        await saveToken("local", token);
      } catch (err) {
        setStatus("error");
        setErrorMsg(
          err instanceof Error
            ? `Could not save token to browser storage: ${err.message}`
            : "Could not save token to browser storage.",
        );
        return;
      }

      router.replace("/workspace/");
    })();
  }, [router]);

  if (status === "error") {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="mb-2 text-lg font-semibold">Setup failed</h1>
          <p className="mb-4 text-sm text-fg-muted">{errorMsg}</p>
          <Link href="/" className="text-sm font-medium text-fg underline underline-offset-2">
            Go home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-fg-muted">Configuring…</p>
    </main>
  );
}
