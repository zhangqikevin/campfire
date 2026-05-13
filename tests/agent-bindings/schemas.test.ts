import { describe, expect, it } from "vitest";
import { createBindingSchema, tokenSchema } from "@/lib/agent-bindings/schemas";

describe("createBindingSchema", () => {
  it("accepts a valid ws:// URL", () => {
    const result = createBindingSchema.safeParse({
      name: "Local",
      url: "ws://localhost:18789",
      kind: "openclaw",
    });
    expect(result.success).toBe(true);
  });

  it("accepts wss:// for remote", () => {
    const result = createBindingSchema.safeParse({
      name: "Remote",
      url: "wss://gateway.example.com",
      kind: "openclaw",
    });
    expect(result.success).toBe(true);
  });

  it("rejects http:// URLs", () => {
    const result = createBindingSchema.safeParse({
      name: "Bad",
      url: "http://localhost:18789",
      kind: "openclaw",
    });
    expect(result.success).toBe(false);
  });

  it("rejects URLs without a hostname", () => {
    const result = createBindingSchema.safeParse({
      name: "Bad",
      url: "ws://",
      kind: "openclaw",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-URL", () => {
    const result = createBindingSchema.safeParse({
      name: "Bad",
      url: "localhost:18789",
      kind: "openclaw",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createBindingSchema.safeParse({
      name: "",
      url: "ws://localhost:18789",
      kind: "openclaw",
    });
    expect(result.success).toBe(false);
  });

  it("trims name whitespace", () => {
    const result = createBindingSchema.safeParse({
      name: "  Local  ",
      url: "ws://localhost:18789",
      kind: "openclaw",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Local");
  });

  it("rejects names longer than 80 chars", () => {
    const result = createBindingSchema.safeParse({
      name: "x".repeat(81),
      url: "ws://localhost:18789",
      kind: "openclaw",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported kind", () => {
    const result = createBindingSchema.safeParse({
      name: "X",
      url: "ws://localhost:18789",
      kind: "hermes",
    });
    expect(result.success).toBe(false);
  });
});

describe("tokenSchema", () => {
  it("accepts a non-empty token", () => {
    expect(tokenSchema.safeParse("abc123").success).toBe(true);
  });

  it("rejects an empty token", () => {
    expect(tokenSchema.safeParse("").success).toBe(false);
  });

  it("rejects whitespace-only tokens", () => {
    expect(tokenSchema.safeParse("   ").success).toBe(false);
  });
});
