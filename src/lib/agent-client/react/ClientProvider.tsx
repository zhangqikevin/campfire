"use client";

import { createContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Client } from "@/lib/agent-client/client";
import { ConnectionState } from "@/lib/agent-client/types";
import { getToken } from "@/lib/agent-bindings/token-store";

interface ClientContextValue {
  client: Client | null;
  state: ConnectionState;
  /** Set when we couldn't load a token from IndexedDB at all. */
  missingToken: boolean;
}

export const ClientContext = createContext<ClientContextValue>({
  client: null,
  state: ConnectionState.DISCONNECTED,
  missingToken: false,
});

interface ClientProviderProps {
  bindingId: string;
  url: string;
  children: ReactNode;
}

export function ClientProvider({ bindingId, url, children }: ClientProviderProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [state, setState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [missingToken, setMissingToken] = useState(false);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getToken(bindingId);
      if (cancelled) return;
      if (!token) {
        setMissingToken(true);
        setState(ConnectionState.AUTH_FAILED);
        return;
      }
      setMissingToken(false);
      const c = new Client({ bindingId, url, token });
      clientRef.current = c;
      const off = c.onStateChange((s) => setState(s));
      void c.connect();
      setClient(c);

      return () => off();
    })();

    return () => {
      cancelled = true;
      clientRef.current?.disconnect();
      clientRef.current = null;
      setClient(null);
    };
    // We intentionally only re-run when binding/url changes — token refresh
    // is handled by remounting the provider after a re-bind.
  }, [bindingId, url]);

  return (
    <ClientContext.Provider value={{ client, state, missingToken }}>
      {children}
    </ClientContext.Provider>
  );
}
