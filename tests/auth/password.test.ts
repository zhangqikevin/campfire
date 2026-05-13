import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/auth/password";

describe("hashPassword", () => {
  it("produces a bcrypt hash distinct from the plaintext", async () => {
    const hash = await hashPassword("hunter2hunter2");
    expect(hash).not.toBe("hunter2hunter2");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("produces a different hash each time (salt is random)", async () => {
    const a = await hashPassword("hunter2hunter2");
    const b = await hashPassword("hunter2hunter2");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("returns false for the wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong horse battery staple", hash)).toBe(false);
  });

  it("returns false for an empty hash without throwing", async () => {
    expect(await verifyPassword("anything", "")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  it("is idempotent", () => {
    const once = normalizeEmail("Alice@Example.com");
    expect(normalizeEmail(once)).toBe(once);
  });

  it("treats casing-only differences as the same email", () => {
    expect(normalizeEmail("ALICE@example.com")).toBe(normalizeEmail("alice@EXAMPLE.com"));
  });
});
