"use client";

import { useTransition } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      onClick={() => startTransition(() => logoutAction())}
      disabled={isPending}
    >
      {isPending ? "Logging out…" : "Log out"}
    </Button>
  );
}
