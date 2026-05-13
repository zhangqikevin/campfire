import { describe, expect, it } from "vitest";
import {
  CAMPFIRE_SUFFIX,
  encodeExtra,
  encodeMain,
  extractAgentIdFromKey,
  hasCampfireSuffix,
  isMainSession,
} from "@/lib/agent-client/session-keys";

describe("encodeMain", () => {
  it("produces agent:<id>:main:<suffix>", () => {
    expect(encodeMain("alice")).toBe(`agent:alice:main${CAMPFIRE_SUFFIX}`);
  });
});

describe("encodeExtra", () => {
  it("includes a slot uuid by default", () => {
    const key = encodeExtra("alice");
    expect(key).toMatch(/^agent:alice:[0-9a-f-]+:campfire$/i);
  });

  it("respects an explicit slot id", () => {
    const key = encodeExtra("alice", "scratch");
    expect(key).toBe(`agent:alice:scratch${CAMPFIRE_SUFFIX}`);
  });
});

describe("hasCampfireSuffix", () => {
  it("recognizes valid Campfire keys", () => {
    expect(hasCampfireSuffix(encodeMain("alice"))).toBe(true);
    expect(hasCampfireSuffix(encodeExtra("alice"))).toBe(true);
  });

  it("rejects keys without the suffix", () => {
    expect(hasCampfireSuffix("agent:alice:main")).toBe(false);
    expect(hasCampfireSuffix("alice")).toBe(false);
  });
});

describe("isMainSession", () => {
  it("returns true only for main-slot keys", () => {
    expect(isMainSession(encodeMain("alice"))).toBe(true);
    expect(isMainSession(encodeExtra("alice"))).toBe(false);
  });
});

describe("extractAgentIdFromKey", () => {
  it("pulls the agent id out of a main key", () => {
    expect(extractAgentIdFromKey(encodeMain("alice"))).toBe("alice");
  });

  it("pulls the agent id out of an extra key", () => {
    expect(extractAgentIdFromKey(encodeExtra("bob"))).toBe("bob");
  });

  it("returns null for non-Campfire keys", () => {
    expect(extractAgentIdFromKey("agent:alice:main")).toBeNull();
    expect(extractAgentIdFromKey("nonsense")).toBeNull();
  });
});
