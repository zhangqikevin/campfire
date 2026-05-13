"use client";

import { useEffect, useState } from "react";
import { useClient } from "./useClient";
import { ConnectionState } from "@/lib/agent-client/types";

type Status = "idle" | "loading" | "ok" | "error";

export interface GatewayQueryResult<T> {
  data: T | null;
  status: Status;
  error: string | null;
  refetch: () => void;
}

/**
 * Run a gateway RPC and reactively re-run when the connection comes back up
 * or `key` changes. Intended for read-only methods (`openclawos.apps.list`,
 * `openclawos.artifacts.get`, etc.). For chat-stream lifecycle, use
 * `useChatThread` instead.
 */
export function useGatewayQuery<T>(
  method: string,
  params: Record<string, unknown> | undefined,
  key: unknown,
): GatewayQueryResult<T> {
  const { client, state } = useClient();
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!client || state !== ConnectionState.CONNECTED) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);
    (async () => {
      try {
        const result = await client.request<T>(method, params);
        if (cancelled) return;
        setData(result);
        setStatus("ok");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Request failed");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, state, method, key, tick]);

  return {
    data,
    status,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}
