"use client";

import { useEffect, useRef } from "react";
import { Composer } from "@/components/chat/Composer";
import { ConnectionStatus } from "@/components/chat/ConnectionStatus";
import { MessageContent } from "@/components/chat/MessageContent";
import { useClient } from "@/lib/agent-client/react/useClient";
import { useChatThread } from "@/lib/agent-client/react/useChatThread";
import { ConnectionState } from "@/lib/agent-client/types";

interface ChatSurfaceProps {
  sessionKey: string;
}

export function ChatSurface({ sessionKey }: ChatSurfaceProps) {
  const { client, state, missingToken } = useClient();
  const { messages, streamingText, isStreaming, sendError, send, abort } = useChatThread({
    client,
    sessionKey,
  });

  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, streamingText]);

  const ready = state === ConnectionState.CONNECTED;

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[28rem] flex-col gap-3">
      <div className="flex items-center justify-between">
        <ConnectionStatus state={state} />
        {sendError ? <span className="text-xs text-danger">{sendError}</span> : null}
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto rounded-lg border border-border bg-bg-subtle p-4"
      >
        {missingToken ? (
          <p className="text-sm text-danger">
            No token stored in this browser for this binding. Re-bind the agent from the Agents
            page to enter the token again.
          </p>
        ) : null}

        {!missingToken && state !== ConnectionState.CONNECTED && state !== ConnectionState.CONNECTING ? (
          <p className="text-sm text-fg-muted">
            {state === ConnectionState.AUTH_FAILED
              ? "Auth failed. Verify the token on the Agents page."
              : state === ConnectionState.UNREACHABLE
                ? "Gateway unreachable. Check the URL and that your OpenClaw is running."
                : "Disconnected."}
          </p>
        ) : null}

        {messages.length === 0 && !streamingText && ready ? (
          <p className="text-sm text-fg-muted">
            Send your first message to start the conversation.
          </p>
        ) : null}

        <div className="space-y-6">
          {messages.map((m) => (
            <div key={m.id}>
              <div className="mb-1 text-xs uppercase tracking-wide text-fg-subtle">
                {m.role === "user" ? "You" : "Agent"}
              </div>
              <MessageContent content={m.content} onFollowUp={send} />
            </div>
          ))}

          {streamingText ? (
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-fg-subtle">Agent</div>
              <MessageContent content={streamingText} isStreaming onFollowUp={send} />
            </div>
          ) : null}
        </div>
      </div>

      <Composer
        onSend={send}
        onAbort={abort}
        disabled={!ready}
        isStreaming={isStreaming}
        placeholder={ready ? "Message your agent…" : "Waiting for connection…"}
      />
    </div>
  );
}
