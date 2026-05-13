"use client";

import { ConnectionState } from "@/lib/agent-client/types";

const LABELS: Record<ConnectionState, string> = {
  DISCONNECTED: "Disconnected",
  CONNECTING: "Connecting…",
  CONNECTED: "Connected",
  AUTH_FAILED: "Auth failed",
  PAIRING: "Pairing required",
  UNREACHABLE: "Unreachable",
};

const DOT_CLASS: Record<ConnectionState, string> = {
  DISCONNECTED: "bg-fg-subtle",
  CONNECTING: "bg-fg-muted animate-pulse",
  CONNECTED: "bg-accent",
  AUTH_FAILED: "bg-danger",
  PAIRING: "bg-fg-muted",
  UNREACHABLE: "bg-danger",
};

interface ConnectionStatusProps {
  state: ConnectionState;
}

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[state]}`} aria-hidden />
      {LABELS[state]}
    </span>
  );
}
