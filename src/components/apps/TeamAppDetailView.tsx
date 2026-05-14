"use client";

import { Renderer } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { useMemo } from "react";
import { useClient } from "@/lib/agent-client/react/useClient";
import { ConnectionState } from "@/lib/agent-client/types";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/defaults.css";

interface TeamAppDetailViewProps {
  app: {
    id: string;
    title: string;
    description: string | null;
    content: string;
  };
  /** Per-render session key so Query/Mutation tools land in a dedicated slot. */
  sessionKey: string;
}

export function TeamAppDetailView({ app, sessionKey }: TeamAppDetailViewProps) {
  const { client, state } = useClient();

  // Same tool-provider plumbing as the Personal App renderer — but the source
  // is admin-authored and the data lives in *this* binding's gateway, so Team
  // Apps stay read-only as templates while each account gets its own data.
  const toolProvider = useMemo(() => {
    if (!client) return null;
    const proxy = async (toolName: string, toolArgs: Record<string, unknown>) => {
      const result = await client.request<{ result: unknown }>("campfire.tools.invoke", {
        tool_name: toolName,
        tool_args: toolArgs,
        sessionKey,
      });
      return result?.result ?? null;
    };
    return {
      exec: (args: Record<string, unknown>) => proxy("exec", args),
      bash: (args: Record<string, unknown>) => proxy("exec", args),
      shell: (args: Record<string, unknown>) => proxy("exec", args),
      read: (args: Record<string, unknown>) => proxy("read", args),
      db_query: (args: Record<string, unknown>) => proxy("db_query", args),
      db_execute: (args: Record<string, unknown>) => proxy("db_execute", args),
    };
  }, [client, sessionKey]);

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return (
      <p className="rounded-md border border-border bg-bg-subtle p-4 text-sm text-fg-muted">
        Not connected to the gateway. Team Apps render live against this binding&apos;s gateway.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{app.title}</h2>
          <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
            team
          </span>
        </div>
        {app.description ? (
          <p className="mt-1 text-sm text-fg-muted">{app.description}</p>
        ) : null}
      </div>
      <div className="rounded-lg border border-border bg-bg-subtle p-4">
        <Renderer
          response={app.content}
          library={openuiLibrary}
          toolProvider={toolProvider}
          onError={(errors) => {
            if (errors.length > 0) console.warn("[campfire:team-app-render]", errors);
          }}
        />
      </div>
    </div>
  );
}
