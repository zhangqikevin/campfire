import { describe, expect, it, beforeAll } from "vitest";

// Set env BEFORE importing the module-under-test — env.ts validates at import
// time, and encryption.ts caches the parsed key. The test key is a fixed
// 32-byte base64 string so reruns are deterministic.
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");
beforeAll(() => {
  process.env["CAMPFIRE_TOKEN_ENCRYPTION_KEY"] = TEST_KEY;
  if (!process.env["AUTH_SECRET"]) {
    process.env["AUTH_SECRET"] = Buffer.alloc(32, 1).toString("base64");
  }
  if (!process.env["DATABASE_URL"]) {
    process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  }
});

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips plaintext", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/auth/encryption");
    const original = "secret-token-44332ed4716ffcedcb75c82896a4313a41a481b3e3c364d";
    const enc = encryptToken(original);
    expect(enc.ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(enc.nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decryptToken(enc)).toBe(original);
  });

  it("produces a fresh nonce on every encrypt", async () => {
    const { encryptToken } = await import("@/lib/auth/encryption");
    const a = encryptToken("same-plaintext");
    const b = encryptToken("same-plaintext");
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("rejects tampered ciphertext (auth tag fails)", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/auth/encryption");
    const enc = encryptToken("real-token");
    // Flip a byte near the start of the ciphertext.
    const buf = Buffer.from(enc.ciphertext, "base64");
    buf[0] = buf[0]! ^ 0xff;
    const tampered = { ciphertext: buf.toString("base64"), nonce: enc.nonce };
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("rejects tampered nonce", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/auth/encryption");
    const enc = encryptToken("real-token");
    const nonceBuf = Buffer.from(enc.nonce, "base64");
    nonceBuf[0] = nonceBuf[0]! ^ 0x55;
    expect(() =>
      decryptToken({ ciphertext: enc.ciphertext, nonce: nonceBuf.toString("base64") }),
    ).toThrow();
  });

  it("rejects empty plaintext at encrypt time", async () => {
    const { encryptToken } = await import("@/lib/auth/encryption");
    expect(() => encryptToken("")).toThrow();
  });

  it("rejects a too-short ciphertext (missing auth tag)", async () => {
    const { decryptToken } = await import("@/lib/auth/encryption");
    const shortCt = Buffer.alloc(8).toString("base64");
    const nonce = Buffer.alloc(12).toString("base64");
    expect(() => decryptToken({ ciphertext: shortCt, nonce })).toThrow(/auth tag/i);
  });
});
