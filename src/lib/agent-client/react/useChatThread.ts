"use client";

import { useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { ClientContext } from "@/lib/agent-client/react/ClientProvider";
import type {
  ThreadMessage,
  ThreadSnapshot,
} from "@/lib/agent-client/react/chat-thread-store";

export type { ThreadMessage } from "@/lib/agent-client/react/chat-thread-store";

interface UseChatThreadOptions {
  sessionKey: string;
}

interface UseChatThreadReturn {
  messages: ThreadMessage[];
  streamingText: string;
  isStreaming: boolean;
  isSending: boolean;
  /** Last error from a send attempt; null on success. */
  sendError: string | null;
  /** Send the user message; agent's reply streams into state. */
  send: (text: string) => Promise<void>;
  abort: () => Promise<void>;
}

const EMPTY: ThreadSnapshot = {
  messages: [],
  streamingText: "",
  isStreaming: false,
  isSending: false,
  sendError: null,
  historyLoaded: false,
};

/**
 * Chat thread state hook. Backed by `ChatThreadStore` (owned by
 * `ClientProvider`) so messages + streaming progress survive tab switches
 * inside the binding workspace — Apps / Artifacts / Crons tab can be
 * browsed while a run streams in the background, and switching back to
 * Chat shows everything that arrived.
 */
export function useChatThread({ sessionKey }: UseChatThreadOptions): UseChatThreadReturn {
  const { chatStore } = useContext(ClientContext);

  const snapshot = useSyncExternalStore<ThreadSnapshot>(
    useCallback(
      (onChange) => {
        if (!chatStore) return () => undefined;
        return chatStore.subscribe(sessionKey, onChange);
      },
      [chatStore, sessionKey],
    ),
    () => (chatStore ? chatStore.getSnapshot(sessionKey) : EMPTY),
    () => EMPTY,
  );

  // Load chat.history once per session; idempotent across remounts.
  useEffect(() => {
    if (!chatStore) return;
    void chatStore.ensureHistoryLoaded(sessionKey);
  }, [chatStore, sessionKey]);

  const send = useCallback(
    async (text: string) => {
      if (!chatStore) return;
      await chatStore.send(sessionKey, text);
    },
    [chatStore, sessionKey],
  );

  const abort = useCallback(async () => {
    if (!chatStore) return;
    await chatStore.abort(sessionKey);
  }, [chatStore, sessionKey]);

  return {
    messages: snapshot.messages,
    streamingText: snapshot.streamingText,
    isStreaming: snapshot.isStreaming,
    isSending: snapshot.isSending,
    sendError: snapshot.sendError,
    send,
    abort,
  };
}
