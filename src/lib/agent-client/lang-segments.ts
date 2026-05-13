// Splits an assistant message into a sequence of plain-text and OpenUI Lang
// fenced-block segments. The OpenUI Lang system prompt tells the agent to
// emit Lang code inside ```openui-lang ... ``` fences (see the inline-UI
// prompt in openclaw-os-plugin/prompts/openui-inline-ui.md); we look for
// exactly that marker.
//
// During streaming the closing fence may not have arrived yet — in that case
// the trailing chunk is still emitted as a Lang segment with `complete:false`,
// so the renderer can show partial output as it's typed.

export type Segment =
  | { kind: "text"; content: string }
  | { kind: "lang"; content: string; complete: boolean };

const FENCE_OPEN = "```openui-lang";
const FENCE_CLOSE = "```";

export function parseSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    const openIdx = input.indexOf(FENCE_OPEN, cursor);
    if (openIdx === -1) {
      const rest = input.slice(cursor);
      if (rest.length > 0) segments.push({ kind: "text", content: rest });
      break;
    }

    if (openIdx > cursor) {
      segments.push({ kind: "text", content: input.slice(cursor, openIdx) });
    }

    let langStart = openIdx + FENCE_OPEN.length;
    // Optional newline immediately after the fence marker.
    if (input[langStart] === "\n") langStart += 1;

    const closeIdx = input.indexOf(FENCE_CLOSE, langStart);
    if (closeIdx === -1) {
      // Streaming: fence is still open. Emit the partial body.
      segments.push({
        kind: "lang",
        content: input.slice(langStart),
        complete: false,
      });
      break;
    }

    let body = input.slice(langStart, closeIdx);
    // Trim the single trailing newline that conventionally precedes the close fence.
    if (body.endsWith("\n")) body = body.slice(0, -1);

    segments.push({ kind: "lang", content: body, complete: true });
    cursor = closeIdx + FENCE_CLOSE.length;
  }

  return segments;
}
