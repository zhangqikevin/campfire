import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/auth/schemas";

describe("signupSchema", () => {
  it("accepts a valid email and 8+ char password", () => {
    const result = signupSchema.safeParse({ email: "a@b.co", password: "abcdefgh" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({ email: "not-an-email", password: "abcdefgh" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({ email: "a@b.co", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password).toBeDefined();
    }
  });

  it("rejects passwords longer than 128 characters", () => {
    const result = signupSchema.safeParse({
      email: "a@b.co",
      password: "x".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace around email", () => {
    const result = signupSchema.safeParse({ email: "  a@b.co  ", password: "abcdefgh" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("a@b.co");
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const result = loginSchema.safeParse({ email: "", password: "anything" });
    expect(result.success).toBe(false);
  });
});
