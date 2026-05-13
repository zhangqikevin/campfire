/**
 * Reachability probe for an OpenClaw gateway. Opens a WebSocket to `url` and
 * waits for either:
 *   - a `connect.challenge` event (proves it's openclaw), OR
 *   - the socket opening and staying open for `softTimeoutMs` (proves the
 *     URL points at *some* WS server, even if we don't see openclaw frames).
 *
 * We do NOT run the full v3 signed handshake here — that needs ed25519 keys
 * and the token, and is the job of the chat layer (next slice). This probe
 * just catches typos, wrong ports, and unreachable hosts before they bite
 * the user in the middle of a conversation.
 */

export type VerifyResult =
  | { ok: true; sawChallenge: boolean }
  | { ok: false; reason: string };

export async function verifyOpenClawReachable(
  url: string,
  opts: { hardTimeoutMs?: number; softTimeoutMs?: number } = {},
): Promise<VerifyResult> {
  const hardTimeoutMs = opts.hardTimeoutMs ?? 6000;
  const softTimeoutMs = opts.softTimeoutMs ?? 2000;

  return new Promise<VerifyResult>((resolve) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      resolve({ ok: false, reason: err instanceof Error ? err.message : "Invalid URL" });
      return;
    }

    let settled = false;
    let opened = false;
    let softTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: VerifyResult) => {
      if (settled) return;
      settled = true;
      if (softTimer) clearTimeout(softTimer);
      clearTimeout(hardTimer);
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const hardTimer = setTimeout(
      () =>
        finish({
          ok: false,
          reason: opened
            ? `No frames received within ${hardTimeoutMs}ms`
            : `Timed out connecting to ${url} after ${hardTimeoutMs}ms`,
        }),
      hardTimeoutMs,
    );

    ws.onopen = () => {
      opened = true;
      // If we don't see a challenge within softTimeoutMs, accept the URL as
      // "reachable" anyway. Some gateways might not send challenge until they
      // see a client frame.
      softTimer = setTimeout(() => finish({ ok: true, sawChallenge: false }), softTimeoutMs);
    };

    ws.onmessage = (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : "";
        const frame = JSON.parse(raw) as { type?: unknown; event?: unknown };
        if (frame.type === "event" && frame.event === "connect.challenge") {
          finish({ ok: true, sawChallenge: true });
        }
      } catch {
        // not JSON — ignore
      }
    };

    ws.onerror = () => {
      finish({
        ok: false,
        reason: opened ? "Connection error after open" : `Could not reach ${url}`,
      });
    };

    ws.onclose = (event) => {
      if (settled) return;
      finish({
        ok: false,
        reason: opened
          ? `Connection closed before challenge (code ${event.code})`
          : `Connection refused (code ${event.code})`,
      });
    };
  });
}
