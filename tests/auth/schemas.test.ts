import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/auth/schemas";

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

  it("trims whitespace around email", () => {
    const result = loginSchema.safeParse({ email: "  a@b.co  ", password: "anything" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("a@b.co");
  });
});
