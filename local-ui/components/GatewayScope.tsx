"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ClientProvider } from "@/lib/agent-client/react/ClientProvider";

// Derive the gateway WS URL from the page origin. The plugin serves the UI
// from the same host as the WebSocket gateway, so we keep host+port and
// swap protocol.
//
// When the gateway is behind a reverse proxy with a path prefix (e.g.
// `https://example.com/oc/pokeball/plugins/campfire/`), the proxy must also
// terminate the WebSocket — so the WS URL needs to include that path prefix
// up to (but not including) `/plugins/campfire`. We dig the prefix out of
// the current pathname rather than baking it into the bundle, so the same
// build works whether served at the root or behind any proxy prefix.
function gatewayWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:18789";
  const { protocol, host, pathname } = window.location;
  const wsProtocol = protocol === "https:" ? "wss:" : "ws:";
  const idx = pathname.indexOf("/plugins/campfire");
  const externalPrefix = idx > 0 ? pathname.slice(0, idx) : "";
  return `${wsProtocol}//${host}${externalPrefix}`;
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
