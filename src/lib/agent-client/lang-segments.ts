// Splits an assistant message into ordered text and OpenUI Lang segments.
//
// Detection modes (must handle all of these — observed in real model output):
//
//   1. Standard fence:   `​```openui-lang\nBODY\n```` — tag on the same line.
//   2. Tag-on-next-line: `​```\nopenui-lang\nBODY\n```` — model puts the
//      language tag as the first line of the body. Common with some models
//      that don't reliably emit the inline-tag form.
//   3. Streaming unclosed fence — `​```openui-lang\nBODY…` (or the next-line
//      variant) with no close fence yet. Surface the tail as a Lang segment
//      with complete:false so partial UI renders as tokens arrive.
//   4. Pure-code fallback — no fences at all, but most non-blank lines look
//      like top-level `name = Component(...)` assignments. Some prompts /
//      models skip fences entirely; without this fallback the whole reply
//      renders as plain text.
//
// Non-openui-lang fenced blocks (`​```python`, `​```ts`, …) stay in the text
// stream — we don't try to render those.

export type Segment =
  | { kind: "text"; content: string }
  | { kind: "lang"; content: string; complete: boolean };

const STATEMENT_PATTERN = /^[a-zA-Z_$][\w$]*\s*=/;

// Capture every fenced block. Group 1 is the language tag (possibly empty
// or whitespace); group 2 is the body. The regex deliberately allows an
// empty tag so we can pick up `​```\nopenui-lang\n…` and decide tag-ness
// from the body.
const FENCE_REGEX = /```([^\n`]*)\n([\s\S]*?)```/g;
// Same shape but unterminated — for streaming.
const UNCLOSED_FENCE_REGEX = /```([^\n`]*)\n([\s\S]*)$/;

const OPENUI_TAG_ALIASES = new Set([
  "openui-lang",
  "openuilang",
  "openui_lang",
  "openui",
]);

function isOpenuiTag(s: string): boolean {
  return OPENUI_TAG_ALIASES.has(s.trim().toLowerCase());
}

/**
 * Given a captured fenced block, decide whether it's an openui-lang block
 * and return the cleaned body. Two acceptable forms:
 *
 *   ```openui-lang     ← tag in fence header
 *   BODY
 *   ```
 *
 *   ```                ← no tag in header
 *   openui-lang        ← tag as first body line
 *   BODY
 *   ```
 */
function classifyFenced(tag: string, body: string): {
  isLang: boolean;
  content: string;
} {
  if (isOpenuiTag(tag)) {
    return { isLang: true, content: body.replace(/\n$/, "") };
  }
  // tag absent / different — check if first body line is the language marker
  if (!tag.trim()) {
    const newlineIdx = body.indexOf("\n");
    const firstLine = newlineIdx === -1 ? body : body.slice(0, newlineIdx);
    if (isOpenuiTag(firstLine)) {
      const rest = newlineIdx === -1 ? "" : body.slice(newlineIdx + 1);
      return { isLang: true, content: rest.replace(/\n$/, "") };
    }
  }
  return { isLang: false, content: body };
}

/**
 * True when a fence-less message looks like pure openui-lang — >70% of
 * non-blank lines are `name = Component(...)` assignments AND no backticks
 * are present (any backtick implies the model intended a fence).
 */
function looksLikePureCode(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.includes("```")) return false;
  const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  const stmtCount = lines.filter((l) => STATEMENT_PATTERN.test(l)).length;
  return stmtCount / lines.length > 0.7;
}

export function parseSegments(input: string): Segment[] {
  if (!input.trim()) return [];

  // Mode 4: pure-code fallback (fence-less, mostly assignments).
  if (looksLikePureCode(input)) {
    return [{ kind: "lang", content: input.trim(), complete: true }];
  }

  const segments: Segment[] = [];
  let lastIndex = 0;

  // Modes 1 + 2: walk complete fenced blocks.
  const re = new RegExp(FENCE_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const tag = match[1] ?? "";
    const body = match[2] ?? "";
    const { isLang, content } = classifyFenced(tag, body);

    const textBefore = input.slice(lastIndex, match.index);
    if (textBefore.trim()) segments.push({ kind: "text", content: textBefore });

    if (isLang && content.trim()) {
      segments.push({ kind: "lang", content, complete: true });
    } else {
      // Non-openui fence stays in the text stream verbatim so the user still
      // sees their python/ts/etc. block (we don't try to syntax-highlight it).
      segments.push({ kind: "text", content: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  // Mode 3: streaming — unterminated fence at the tail.
  const remainder = input.slice(lastIndex);
  const unclosed = remainder.match(UNCLOSED_FENCE_REGEX);
  if (unclosed && typeof unclosed.index === "number") {
    const textBefore = remainder.slice(0, unclosed.index);
    if (textBefore.trim()) segments.push({ kind: "text", content: textBefore });
    const tag = unclosed[1] ?? "";
    const body = unclosed[2] ?? "";
    const { isLang, content } = classifyFenced(tag, body);
    if (isLang) {
      if (content.trim()) segments.push({ kind: "lang", content, complete: false });
    } else {
      // Non-openui in-progress fence — keep as text.
      segments.push({ kind: "text", content: remainder.slice(unclosed.index) });
    }
  } else if (remainder.trim()) {
    segments.push({ kind: "text", content: remainder });
  }

  if (segments.length === 0) {
    segments.push({ kind: "text", content: input });
  }

  return segments;
}
