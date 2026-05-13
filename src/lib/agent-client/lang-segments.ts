// Splits an assistant message into ordered text and OpenUI Lang segments.
//
// Three detection modes (matches openclaw-os's `parseInlineResponse`):
//
//   1. Fenced — `​```openui-lang\n...```` blocks. The canonical, prompt-prescribed
//      form. Handles multiple fences in one message and text in between.
//   2. Streaming unclosed fence — `​```openui-lang\n...` with no close fence yet,
//      typical mid-stream. Emit the tail as a Lang segment with complete:false
//      so the renderer shows partial UI as tokens arrive.
//   3. Pure-code mode — the message has NO fences but looks like openui-lang
//      anyway (most lines match `identifier = Component(...)` shape). Older
//      prompts skipped the fence requirement and models sometimes still emit
//      this way; without this fallback the whole reply renders as plain text
//      instead of UI.
//
// Returns segments in source order.

export type Segment =
  | { kind: "text"; content: string }
  | { kind: "lang"; content: string; complete: boolean };

const FENCE_OPEN = "```openui-lang";
const FENCE_CLOSE = "```";
const FENCE_REGEX = /```openui-lang\n([\s\S]*?)```/g;
const UNCLOSED_FENCE_REGEX = /```openui-lang\n([\s\S]*)$/;
const STATEMENT_PATTERN = /^[a-zA-Z_$][\w$]*\s*=/;

/**
 * Returns true when a raw response *looks like* pure openui-lang (no fences,
 * most non-blank lines are top-level `name = ...` assignments). Used as a
 * fallback for models that skip the fence wrapper.
 */
function looksLikePureCode(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Any backtick → assume the model intended fences. Don't promote to code.
  if (trimmed.includes("```")) return false;
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const stmtCount = lines.filter((l) => STATEMENT_PATTERN.test(l)).length;
  // >70% of non-blank lines being assignments is a strong signal it's code.
  // Same threshold openclaw-os uses.
  return stmtCount / lines.length > 0.7;
}

export function parseSegments(input: string): Segment[] {
  if (!input.trim()) return [];

  // Mode 3: pure-code fallback.
  if (looksLikePureCode(input)) {
    return [{ kind: "lang", content: input.trim(), complete: true }];
  }

  // Mode 1+2: walk fenced blocks, handle trailing unclosed fence.
  const segments: Segment[] = [];
  let lastIndex = 0;

  const re = new RegExp(FENCE_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const textBefore = input.slice(lastIndex, match.index);
    if (textBefore.trim()) segments.push({ kind: "text", content: textBefore });
    const code = (match[1] ?? "").replace(/\n$/, "");
    if (code.trim()) segments.push({ kind: "lang", content: code, complete: true });
    lastIndex = match.index + match[0].length;
  }

  const remainder = input.slice(lastIndex);
  const unclosed = remainder.match(UNCLOSED_FENCE_REGEX);
  if (unclosed && typeof unclosed.index === "number") {
    const textBefore = remainder.slice(0, unclosed.index);
    if (textBefore.trim()) segments.push({ kind: "text", content: textBefore });
    const code = (unclosed[1] ?? "").trim();
    if (code) segments.push({ kind: "lang", content: code, complete: false });
  } else if (remainder.trim()) {
    segments.push({ kind: "text", content: remainder });
  }

  // If no segments were produced (input was non-empty but matched nothing
  // meaningful), surface the original as text rather than swallow it silently.
  if (segments.length === 0) {
    segments.push({ kind: "text", content: input });
  }

  return segments;
}

// Re-export the fence markers so other modules can stay in sync if they ever
// need to detect openui-lang content (e.g. for persistence / extraction).
export { FENCE_OPEN, FENCE_CLOSE };
