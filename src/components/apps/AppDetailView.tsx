"use client";

import { Renderer } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { useMemo } from "react";
import { useGatewayQuery } from "@/lib/agent-client/react/useGatewayQuery";
import { useClient } from "@/lib/agent-client/react/useClient";
import { ConnectionState } from "@/lib/agent-client/types";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/defaults.css";

interface AppRecord {
  id: string;
  title: string;
  content: string;
  sessionKey?: string;
  agentId?: string;
}

interface AppDetailViewProps {
  appId: string;
}

export function AppDetailView({ appId }: AppDetailViewProps) {
  const { client, state } = useClient();
  const { data, status, error } = useGatewayQuery<{ app: AppRecord | null }>(
    "campfire.apps.get",
    { id: appId },
    appId,
  );

  // Tool provider routes Query()/Mutation() calls inside the app code back to
  // the gateway's campfire.tools.invoke RPC. Trust model: tools run on the
  // user's own OpenClaw gateway (their own machine for local installs);
  // exec/read are allowed because that's where the SKILL.md teaches the
  // agent to fetch external data via curl etc. See plugin/src/index.ts.
  const toolProvider = useMemo(() => {
    if (!client || !data?.app) return null;
    const sessionKey = data.app.sessionKey ?? "";
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
  }, [client, data?.app]);

  if (state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING) {
    return (
      <p className="rounded-md border border-border bg-bg-subtle p-4 text-sm text-fg-muted">
        Not connected to the gateway. Apps render live against the gateway.
      </p>
    );
  }

  if (status === "loading" || status === "idle") return <p className="text-sm text-fg-muted">Loading…</p>;
  if (status === "error") return <p className="text-sm text-danger">{error}</p>;
  if (!data?.app) return <p className="text-sm text-fg-muted">App not found.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{data.app.title || "Untitled app"}</h2>
        <p className="mt-1 font-mono text-xs text-fg-subtle">{data.app.id}</p>
      </div>
      <div className="rounded-lg border border-border bg-bg-subtle p-4">
        <Renderer
          response={data.app.content}
          library={openuiLibrary}
          toolProvider={toolProvider}
          onError={(errors) => {
            if (errors.length > 0) console.warn("[campfire:app-render]", errors);
          }}
        />
      </div>
    </div>
  );
}
