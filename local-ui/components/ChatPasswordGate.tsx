"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

// SHA-256 hex of the gate password. To rotate:
//   echo -n 'your-new-password' | shasum -a 256 | awk '{print $1}'
// Paste the 64-char hex result here and rebundle.
const CHAT_PW_HASH = "6e4929aa8ea1e4d8133b6e1c4b945207c14f0c35c892a7caa171b8923cec3513";

const CHAT_HREF = "/workspace/chat/";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface ChatPasswordGateProps {
  active: boolean;
}

export function ChatPasswordGate({ active }: ChatPasswordGateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setError(false);
    setSubmitting(false);
  }

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setError(false);
    setOpen(true);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const value = inputRef.current?.value ?? "";
    setSubmitting(true);
    const hash = await sha256Hex(value);
    if (hash === CHAT_PW_HASH) {
      close();
      router.push(CHAT_HREF);
    } else {
      setError(true);
      setSubmitting(false);
      inputRef.current?.select();
    }
  }

  return (
    <>
      <a
        href={CHAT_HREF}
        onClick={handleClick}
        className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
          active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
        }`}
      >
        Chat
      </a>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={close}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-lg border border-border bg-bg-subtle p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-pw-title"
          >
            <h2 id="chat-pw-title" className="text-base font-semibold">
              Enter password
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Chat is locked. Enter the password to open it.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input
                ref={inputRef}
                type="password"
                autoComplete="off"
                disabled={submitting}
                className={`block w-full rounded-md border bg-bg px-3 py-2 text-sm text-fg outline-none ${
                  error ? "border-danger" : "border-border focus:border-accent"
                }`}
              />
              {error ? (
                <p className="text-xs text-danger">Incorrect password.</p>
              ) : null}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Unlock
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
