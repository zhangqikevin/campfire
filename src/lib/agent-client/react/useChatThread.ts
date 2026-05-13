"use client";

import { EventType } from "@openuidev/react-headless";
import { useCallback, useEffect, useRef, useState } from "react";
import { createAGUIMapper } from "@/lib/agent-client/agui-mapper";
import type { Client } from "@/lib/agent-client/client";
import type {
  AgentEvent,
  ChatEvent,
  ChatHistoryMessage,
  EventFrame,
} from "@/lib/agent-client/types";

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface UseChatThreadOptions {
  client: Client | null;
  sessionKey: string;
  /** Set to true to refetch history (e.g. after a reconnect). */
  refreshKey?: unknown;
}

interface UseChatThreadReturn {
  messages: ThreadMessage[];
  streamingText: string;
  isStreaming: boolean;
  isSending: boolean;
  /** Last error from a send attempt; null on success. */
  sendError: string | null;
  /** Send the user message and wait for the agent's response to start streaming. */
  send: (text: string) => Promise<void>;
  abort: () => Promise<void>;
}

function historyToMessages(history: ChatHistoryMessage[]): ThreadMessage[] {
  return history
    .map((m, i) => {
      const role = typeof m.role === "string" ? m.role : "";
      const content =
        typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((p) => {
                  if (!p || typeof p !== "object") return "";
                  const part = p as { type?: unknown; text?: unknown };
                  return part.type === "text" && typeof part.text === "string" ? part.text : "";
                })
                .join("")
            : "";
      const id = typeof m.id === "string" ? m.id : `hist-${i}`;
      if (role !== "user" && role !== "assistant") return null;
      return { id, role, content };
    })
    .filter((m): m is ThreadMessage => m !== null && m.content.length > 0);
}

export function useChatThread({
  client,
  sessionKey,
  refreshKey,
}: UseChatThreadOptions): UseChatThreadReturn {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const streamingIdRef = useRef<string | null>(null);

  // Load history when client / session changes.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        const history = await client.loadHistory(sessionKey);
        if (cancelled) return;
        setMessages(historyToMessages(history));
      } catch (err) {
        if (cancelled) return;
        console.warn("[campfire:chat] history load failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, sessionKey, refreshKey]);

  // Subscribe to gateway events for this session, run them through the AGUI
  // mapper, and reflect into local state.
  useEffect(() => {
    if (!client) return;

    let assistantBuffer = "";

    const mapper = createAGUIMapper((event) => {
      const type = event["type"];
      if (type === EventType.TEXT_MESSAGE_START) {
        const id = typeof event["messageId"] === "string" ? event["messageId"] : crypto.randomUUID();
        streamingIdRef.current = id;
        assistantBuffer = "";
        setIsStreaming(true);
        setStreamingText("");
        return;
      }
      if (type === EventType.TEXT_MESSAGE_CONTENT) {
        const delta = typeof event["delta"] === "string" ? event["delta"] : "";
        if (!delta) return;
        assistantBuffer += delta;
        setStreamingText(assistantBuffer);
        return;
      }
      if (type === EventType.TEXT_MESSAGE_END) {
        const id = streamingIdRef.current ?? crypto.randomUUID();
        const text = assistantBuffer;
        if (text.length > 0) {
          setMessages((prev) => [...prev, { id, role: "assistant", content: text }]);
        }
        streamingIdRef.current = null;
        assistantBuffer = "";
        setStreamingText("");
        return;
      }
      if (type === EventType.RUN_FINISHED || type === EventType.RUN_ERROR) {
        setIsStreaming(false);
        setIsSending(false);
        if (type === EventType.RUN_ERROR && typeof event["message"] === "string") {
          setSendError(event["message"] as string);
        }
      }
    });

    const off = client.onEvent((frame: EventFrame) => {
      const payload = frame.payload as { sessionKey?: string } | undefined;
      if (payload?.sessionKey && payload.sessionKey !== sessionKey) return;

      if (frame.event === "agent") {
        mapper.onAgentEvent(payload as unknown as AgentEvent);
      } else if (frame.event === "chat") {
        mapper.onChatEvent(payload as unknown as ChatEvent);
      }
    });

    return off;
  }, [client, sessionKey]);

  const send = useCallback(
    async (text: string) => {
      if (!client || !text.trim()) return;
      const trimmed = text.trim();
      const userId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: userId, role: "user", content: trimmed }]);
      setSendError(null);
      setIsSending(true);
      setIsStreaming(true);
      try {
        await client.sendChat(sessionKey, trimmed);
      } catch (err) {
        setIsSending(false);
        setIsStreaming(false);
        setSendError(err instanceof Error ? err.message : "Failed to send");
      }
    },
    [client, sessionKey],
  );

  const abort = useCallback(async () => {
    if (!client) return;
    await client.abortChat(sessionKey);
  }, [client, sessionKey]);

  return { messages, streamingText, isStreaming, isSending, sendError, send, abort };
}
