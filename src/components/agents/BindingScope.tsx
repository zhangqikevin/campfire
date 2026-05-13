"use client";

import type { ReactNode } from "react";
import { ClientProvider } from "@/lib/agent-client/react/ClientProvider";

interface BindingScopeProps {
  bindingId: string;
  url: string;
  children: ReactNode;
}

export function BindingScope({ bindingId, url, children }: BindingScopeProps) {
  return (
    <ClientProvider bindingId={bindingId} url={url}>
      {children}
    </ClientProvider>
  );
}
