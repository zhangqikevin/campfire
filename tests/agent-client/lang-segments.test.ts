import { describe, expect, it } from "vitest";
import { parseSegments } from "@/lib/agent-client/lang-segments";

describe("parseSegments", () => {
  it("returns a single text segment when there is no fence", () => {
    const segs = parseSegments("just plain text");
    expect(segs).toEqual([{ kind: "text", content: "just plain text" }]);
  });

  it("extracts a complete openui-lang block", () => {
    const input = "before\n```openui-lang\ntitle = Title(\"Hi\")\n```\nafter";
    const segs = parseSegments(input);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toEqual({ kind: "text", content: "before\n" });
    expect(segs[1]).toEqual({
      kind: "lang",
      content: 'title = Title("Hi")',
      complete: true,
    });
    expect(segs[2]).toEqual({ kind: "text", content: "\nafter" });
  });

  it("marks an unclosed fence as incomplete (streaming)", () => {
    const input = "warmup\n```openui-lang\ntitle = Title(\"Hi";
    const segs = parseSegments(input);
    expect(segs[segs.length - 1]).toEqual({
      kind: "lang",
      content: 'title = Title("Hi',
      complete: false,
    });
  });

  it("handles multiple lang blocks in one message", () => {
    const input = "a\n```openui-lang\none\n```\nmid\n```openui-lang\ntwo\n```\nend";
    const segs = parseSegments(input);
    const langSegs = segs.filter((s) => s.kind === "lang");
    expect(langSegs).toEqual([
      { kind: "lang", content: "one", complete: true },
      { kind: "lang", content: "two", complete: true },
    ]);
  });

  it("ignores non-openui-lang fenced blocks (left as text)", () => {
    const input = "```python\nprint('hi')\n```";
    const segs = parseSegments(input);
    expect(segs).toEqual([{ kind: "text", content: input }]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseSegments("")).toEqual([]);
  });

  it("treats fence-less assignment-heavy text as pure openui-lang", () => {
    // No fences — but every non-blank line is a top-level assignment. Some
    // models skip the fence wrapper; without this fallback the whole reply
    // would render as plain text.
    const input = [
      "title = CardHeader(\"Hello\")",
      "chart = LineChart(data=[1,2,3])",
      "root = Stack([title, chart])",
    ].join("\n");
    const segs = parseSegments(input);
    expect(segs).toEqual([{ kind: "lang", content: input, complete: true }]);
  });

  it("does NOT treat prose with an inline equals as pure code", () => {
    const input = "The capital of France = Paris. Easy question.";
    const segs = parseSegments(input);
    expect(segs[0]?.kind).toBe("text");
  });

  it("does NOT treat input containing any backtick as pure code", () => {
    // If the model used any fence markers we trust its intent and don't
    // promote the whole thing.
    const input = "x = 1\n`y` is just inline code";
    const segs = parseSegments(input);
    expect(segs[0]?.kind).toBe("text");
  });

  it("accepts the tag-on-next-line fence form (observed in real model output)", () => {
    // Some models emit ``` and put the language tag as the first body line
    // instead of attaching it to the fence header. Render as lang anyway.
    const input = "intro\n```\nopenui-lang\nroot = Card([])\n```\noutro";
    const segs = parseSegments(input);
    const langSegs = segs.filter((s) => s.kind === "lang");
    expect(langSegs).toEqual([
      { kind: "lang", content: "root = Card([])", complete: true },
    ]);
  });

  it("normalizes case + alias variants of the openui-lang tag", () => {
    // Tag could be 'openui-lang', 'openuilang', 'openui_lang', or 'openui',
    // upper- or lower-case. All should be recognized.
    const variants = ["openui-lang", "OPENUI-LANG", "openuilang", "openui"];
    for (const tag of variants) {
      const segs = parseSegments(`\`\`\`${tag}\nroot = Card([])\n\`\`\``);
      expect(segs.find((s) => s.kind === "lang")).toEqual({
        kind: "lang",
        content: "root = Card([])",
        complete: true,
      });
    }
  });

  it("leaves non-openui fenced blocks (python, ts, …) as text", () => {
    const input = "first\n```python\nprint('hi')\n```\nlast";
    const segs = parseSegments(input);
    expect(segs.some((s) => s.kind === "lang")).toBe(false);
  });
});
