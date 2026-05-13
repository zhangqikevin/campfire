"use client";

import { Renderer } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { parseSegments } from "@/lib/agent-client/lang-segments";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/defaults.css";

interface ActionEventLike {
  type: string;
  params: Record<string, unknown>;
  humanFriendlyMessage: string;
}

interface MessageContentProps {
  content: string;
  /** True while this message is still being streamed in. */
  isStreaming?: boolean;
  /** Called when an Action fires from an interactive component (FollowUpItem
   *  click, form submit via @ToAssistant, etc.). The text sent should be
   *  posted back into the chat as a follow-up user message. */
  onFollowUp?: (text: string) => void;
}

export function MessageContent({
  content,
  isStreaming = false,
  onFollowUp,
}: MessageContentProps) {
  if (!content) return null;
  const segments = parseSegments(content);
  if (segments.length === 0) return null;

  const handleAction = (event: ActionEventLike) => {
    // open_url → open in a new tab. Anything else (continue_conversation,
    // custom) → send humanFriendlyMessage as a follow-up user message.
    if (event.type === "open_url") {
      const url = typeof event.params["url"] === "string" ? event.params["url"] : null;
      if (url && typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }
    const message = event.humanFriendlyMessage?.trim();
    if (message && onFollowUp) onFollowUp(message);
  };

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          if (!seg.content.trim()) return null;
          return (
            <p key={`t-${i}`} className="whitespace-pre-wrap text-sm leading-relaxed">
              {seg.content}
            </p>
          );
        }
        return (
          <div key={`l-${i}`} className="rounded-md border border-border bg-bg p-3">
            <Renderer
              response={seg.content}
              library={openuiChatLibrary}
              isStreaming={isStreaming || !seg.complete}
              onAction={handleAction}
              onError={(errors) => {
                if (errors.length > 0) {
                  console.warn("[campfire:render]", errors);
                }
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
