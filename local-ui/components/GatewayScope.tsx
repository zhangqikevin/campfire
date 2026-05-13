"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ClientProvider } from "@/lib/agent-client/react/ClientProvider";

// Derive the gateway WS URL from the page origin. The plugin serves us from
// the same host:port as the WebSocket gateway, so we just swap protocol.
function gatewayWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:18789";
  const { protocol, host } = window.location;
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${host}`;
}

const LOCAL_BINDING_ID = "local";

interface GatewayScopeProps {
  children: ReactNode;
}

export function GatewayScope({ children }: GatewayScopeProps) {
  // Wait until we're on the client so window.location is real; otherwise the
  // static-export pre-render would freeze a placeholder URL.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(gatewayWsUrl());
  }, []);

  if (!url) {
    return <p className="p-6 text-sm text-fg-muted">Initialising…</p>;
  }

  return (
    <ClientProvider bindingId={LOCAL_BINDING_ID} url={url}>
      {children}
    </ClientProvider>
  );
}
