"use client";

import { Renderer } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import { parseSegments } from "@/lib/agent-client/lang-segments";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/defaults.css";

interface MessageContentProps {
  content: string;
  /** True while this message is still being streamed in. */
  isStreaming?: boolean;
}

export function MessageContent({ content, isStreaming = false }: MessageContentProps) {
  if (!content) return null;
  const segments = parseSegments(content);
  if (segments.length === 0) return null;

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
