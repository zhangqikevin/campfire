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
});
