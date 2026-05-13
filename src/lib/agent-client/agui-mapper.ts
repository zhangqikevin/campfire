"use client";

import { EventType } from "@openuidev/react-headless";
import type { AgentEvent, ChatEvent, LifecycleStreamData } from "./types";

// Minimal OpenClaw-stream → AGUI-event mapper. Streams assistant text deltas
// into a single AGUI assistant message; emits RUN_FINISHED on run completion.
//
// Deliberately omits: thinking/reasoning timeline, inline tool calls, usage
// markers. Those are nice-to-haves that openclaw-os carries via sentinel-
// encoded segments inside the assistant text. We can add them when the
// product needs them; the chat surface works fine without.
export function createAGUIMapper(emit: (event: Record<string, unknown>) => void): {
  onAgentEvent: (evt: AgentEvent) => void;
  onChatEvent: (evt: ChatEvent) => void;
} {
  let messageId: string | null = null;
  let emittedContent = false;

  const ensureStarted = (runId: string) => {
    if (!messageId) {
      messageId = runId;
      emit({ type: EventType.TEXT_MESSAGE_START, messageId, role: "assistant" });
    }
  };

  const finalize = (errorText?: string) => {
    if (errorText) {
      ensureStarted(messageId ?? crypto.randomUUID());
      emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: errorText });
    }
    if (messageId) emit({ type: EventType.TEXT_MESSAGE_END, messageId });
    emit({ type: EventType.RUN_FINISHED });
    messageId = null;
    emittedContent = false;
  };

  const extractFinalText = (message: unknown): string => {
    if (!message || typeof message !== "object") return "";
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return "";
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const p = part as { type?: unknown; text?: unknown };
        return p.type === "text" && typeof p.text === "string" ? p.text : "";
      })
      .join("");
  };

  return {
    onAgentEvent(evt: AgentEvent) {
      if (evt.stream === "assistant") {
        if (typeof evt.data.delta === "string" && evt.data.delta) {
          ensureStarted(evt.runId);
          emittedContent = true;
          emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: evt.data.delta });
        }
        return;
      }
      if (evt.stream === "lifecycle") {
        const ld = evt.data as LifecycleStreamData;
        if (ld.phase === "error") {
          finalize(ld.error ?? "Agent error");
        }
      }
    },
    onChatEvent(evt: ChatEvent) {
      if (evt.state === "final" || evt.state === "aborted") {
        if (!emittedContent) {
          const finalText = extractFinalText(evt.message);
          if (finalText) {
            ensureStarted(evt.runId);
            emit({ type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: finalText });
            emittedContent = true;
          }
        }
        finalize();
      } else if (evt.state === "error") {
        finalize(evt.errorMessage ?? "Agent error");
      }
    },
  };
}
