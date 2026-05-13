"use client";

import { createContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Client } from "@/lib/agent-client/client";
import { ConnectionState } from "@/lib/agent-client/types";
import { getToken } from "@/lib/agent-bindings/token-store";
import { ChatThreadStore } from "@/lib/agent-client/react/chat-thread-store";

interface ClientContextValue {
  client: Client | null;
  state: ConnectionState;
  /** Set when we couldn't load a token from IndexedDB at all. */
  missingToken: boolean;
  /** Chat thread state — survives tab switches inside this binding. */
  chatStore: ChatThreadStore | null;
}

export const ClientContext = createContext<ClientContextValue>({
  client: null,
  state: ConnectionState.DISCONNECTED,
  missingToken: false,
  chatStore: null,
});

interface ClientProviderProps {
  bindingId: string;
  url: string;
  children: ReactNode;
}

export function ClientProvider({ bindingId, url, children }: ClientProviderProps) {
  const [client, setClient] = useState<Client | null>(null);
  const [chatStore, setChatStore] = useState<ChatThreadStore | null>(null);
  const [state, setState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [missingToken, setMissingToken] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const storeRef = useRef<ChatThreadStore | null>(null);

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
      const store = new ChatThreadStore(c);
      storeRef.current = store;
      const off = c.onStateChange((s) => setState(s));
      void c.connect();
      setClient(c);
      setChatStore(store);

      return () => off();
    })();

    return () => {
      cancelled = true;
      storeRef.current?.dispose();
      storeRef.current = null;
      clientRef.current?.disconnect();
      clientRef.current = null;
      setClient(null);
      setChatStore(null);
    };
  }, [bindingId, url]);

  return (
    <ClientContext.Provider value={{ client, state, missingToken, chatStore }}>
      {children}
    </ClientContext.Provider>
  );
}
