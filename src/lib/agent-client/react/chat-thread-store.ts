"use client";

import { EventType } from "@openuidev/react-headless";
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

// Snapshot returned to consumers. Mutable internal state lives in
// `ThreadState`; we hand out shallow copies so React can detect changes via
// referential inequality.
export interface ThreadSnapshot {
  messages: ThreadMessage[];
  streamingText: string;
  isStreaming: boolean;
  isSending: boolean;
  sendError: string | null;
  historyLoaded: boolean;
}

interface ThreadState extends ThreadSnapshot {
  // Internal — not exposed
  streamingId: string | null;
  assistantBuffer: string;
  mapper: ReturnType<typeof createAGUIMapper>;
}

const EMPTY_SNAPSHOT: ThreadSnapshot = {
  messages: [],
  streamingText: "",
  isStreaming: false,
  isSending: false,
  sendError: null,
  historyLoaded: false,
};

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
                  return part.type === "text" && typeof part.text === "string"
                    ? part.text
                    : "";
                })
                .join("")
            : "";
      const id = typeof m.id === "string" ? m.id : `hist-${i}`;
      if (role !== "user" && role !== "assistant") return null;
      return { id, role, content };
    })
    .filter((m): m is ThreadMessage => m !== null && m.content.length > 0);
}

/**
 * Per-binding chat state. Owned by `ClientProvider` (one instance per binding
 * workspace), survives tab switches inside that workspace because the
 * provider's layout stays mounted. Holds per-sessionKey thread state so
 * cross-thread navigation also preserves messages.
 *
 * Event subscriptions live here (not in the React hook), so a streaming run
 * the user kicked off in Chat keeps accumulating into the message buffer
 * even while they browse Apps / Artifacts / Crons tabs.
 */
export class ChatThreadStore {
  private threads = new Map<string, ThreadState>();
  private snapshots = new Map<string, ThreadSnapshot>();
  private listeners = new Map<string, Set<() => void>>();
  private historyInflight = new Map<string, Promise<void>>();
  private unsubscribeFromClient: (() => void) | null = null;

  constructor(private client: Client) {
    this.unsubscribeFromClient = client.onEvent((frame) => this.handleEvent(frame));
  }

  dispose(): void {
    this.unsubscribeFromClient?.();
    this.unsubscribeFromClient = null;
    this.threads.clear();
    this.snapshots.clear();
    this.listeners.clear();
  }

  private rebuildSnapshot(sessionKey: string, s: ThreadState): void {
    this.snapshots.set(sessionKey, {
      messages: s.messages,
      streamingText: s.streamingText,
      isStreaming: s.isStreaming,
      isSending: s.isSending,
      sendError: s.sendError,
      historyLoaded: s.historyLoaded,
    });
  }

  private notify(sessionKey: string): void {
    const state = this.threads.get(sessionKey);
    if (state) this.rebuildSnapshot(sessionKey, state);
    const set = this.listeners.get(sessionKey);
    if (!set) return;
    for (const fn of set) fn();
  }

  private getOrCreate(sessionKey: string): ThreadState {
    const existing = this.threads.get(sessionKey);
    if (existing) return existing;

    const s: ThreadState = {
      messages: [],
      streamingText: "",
      isStreaming: false,
      isSending: false,
      sendError: null,
      historyLoaded: false,
      streamingId: null,
      assistantBuffer: "",
      mapper: null as never, // assigned below
    };

    s.mapper = createAGUIMapper((event) => {
      const type = event["type"];
      if (type === EventType.TEXT_MESSAGE_START) {
        const id =
          typeof event["messageId"] === "string" ? event["messageId"] : crypto.randomUUID();
        s.streamingId = id;
        s.assistantBuffer = "";
        s.isStreaming = true;
        s.streamingText = "";
      } else if (type === EventType.TEXT_MESSAGE_CONTENT) {
        const delta = typeof event["delta"] === "string" ? event["delta"] : "";
        if (!delta) return;
        s.assistantBuffer += delta;
        s.streamingText = s.assistantBuffer;
      } else if (type === EventType.TEXT_MESSAGE_END) {
        const id = s.streamingId ?? crypto.randomUUID();
        const text = s.assistantBuffer;
        if (text.length > 0) {
          s.messages = [...s.messages, { id, role: "assistant", content: text }];
        }
        s.streamingId = null;
        s.assistantBuffer = "";
        s.streamingText = "";
      } else if (type === EventType.RUN_FINISHED || type === EventType.RUN_ERROR) {
        s.isStreaming = false;
        s.isSending = false;
        if (type === EventType.RUN_ERROR && typeof event["message"] === "string") {
          s.sendError = event["message"] as string;
        }
      }
      this.notify(sessionKey);
    });

    this.threads.set(sessionKey, s);
    this.rebuildSnapshot(sessionKey, s);
    return s;
  }

  /** Stable snapshot, suitable as `useSyncExternalStore`'s getter. */
  getSnapshot(sessionKey: string): ThreadSnapshot {
    let snap = this.snapshots.get(sessionKey);
    if (snap) return snap;
    const state = this.getOrCreate(sessionKey);
    this.rebuildSnapshot(sessionKey, state);
    snap = this.snapshots.get(sessionKey);
    return snap ?? EMPTY_SNAPSHOT;
  }

  subscribe(sessionKey: string, fn: () => void): () => void {
    let set = this.listeners.get(sessionKey);
    if (!set) {
      set = new Set();
      this.listeners.set(sessionKey, set);
    }
    set.add(fn);
    return () => {
      set?.delete(fn);
    };
  }

  /** Fetch chat.history once per session, idempotent across concurrent callers. */
  async ensureHistoryLoaded(sessionKey: string): Promise<void> {
    const s = this.getOrCreate(sessionKey);
    if (s.historyLoaded) return;

    let p = this.historyInflight.get(sessionKey);
    if (!p) {
      p = (async () => {
        try {
          const history = await this.client.loadHistory(sessionKey);
          s.messages = historyToMessages(history);
          s.historyLoaded = true;
          this.notify(sessionKey);
        } catch (err) {
          console.warn("[campfire:chat] history load failed:", err);
        } finally {
          this.historyInflight.delete(sessionKey);
        }
      })();
      this.historyInflight.set(sessionKey, p);
    }
    return p;
  }

  /** Force a fresh history reload — useful after reconnect. */
  async reloadHistory(sessionKey: string): Promise<void> {
    const s = this.getOrCreate(sessionKey);
    s.historyLoaded = false;
    return this.ensureHistoryLoaded(sessionKey);
  }

  async send(sessionKey: string, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    const s = this.getOrCreate(sessionKey);
    const userId = crypto.randomUUID();
    s.messages = [...s.messages, { id: userId, role: "user", content: trimmed }];
    s.sendError = null;
    s.isSending = true;
    s.isStreaming = true;
    this.notify(sessionKey);

    try {
      await this.client.sendChat(sessionKey, trimmed);
    } catch (err) {
      s.isSending = false;
      s.isStreaming = false;
      s.sendError = err instanceof Error ? err.message : "Failed to send";
      this.notify(sessionKey);
    }
  }

  async abort(sessionKey: string): Promise<void> {
    await this.client.abortChat(sessionKey);
  }

  private handleEvent(frame: EventFrame): void {
    const payload = frame.payload as { sessionKey?: string } | undefined;
    const sessionKey = payload?.sessionKey;
    if (!sessionKey) return;

    // Only route events to sessions that have been "opened" at least once
    // (i.e. user navigated into chat for them). Otherwise unsolicited events
    // would auto-create empty threads for every sessionKey the gateway
    // broadcasts.
    const s = this.threads.get(sessionKey);
    if (!s) return;

    if (frame.event === "agent") {
      s.mapper.onAgentEvent(payload as unknown as AgentEvent);
    } else if (frame.event === "chat") {
      s.mapper.onChatEvent(payload as unknown as ChatEvent);
    }
  }
}
