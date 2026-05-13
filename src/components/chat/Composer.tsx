"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";

interface ComposerProps {
  onSend: (text: string) => Promise<void> | void;
  onAbort?: () => Promise<void> | void;
  disabled?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

export function Composer({
  onSend,
  onAbort,
  disabled = false,
  isStreaming = false,
  placeholder = "Message your agent…",
}: ComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter to send, Shift-Enter for newline. Matches the convention every
    // chat surface has trained the world to expect.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="block w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-accent disabled:opacity-50"
      />
      <div className="flex items-center justify-end gap-2">
        {isStreaming && onAbort ? (
          <Button type="button" variant="ghost" onClick={() => void onAbort()}>
            Stop
          </Button>
        ) : null}
        <Button type="submit" variant="primary" disabled={disabled || submitting || !text.trim()}>
          {submitting ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
