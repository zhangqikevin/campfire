import { z } from "zod";
import { SUPPORTED_KINDS } from "@/lib/agent-bindings/schemas";

const emailField = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("Enter a valid email");

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

const wsUrl = z
  .string()
  .trim()
  .min(1, "Gateway URL is required")
  .max(2048, "URL is too long")
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return (parsed.protocol === "ws:" || parsed.protocol === "wss:") && !!parsed.hostname;
      } catch {
        return false;
      }
    },
    { message: "Must be a ws:// or wss:// URL with a hostname" },
  );

const tokenField = z
  .string()
  .min(1, "Gateway token is required")
  .max(8192, "Token is too long")
  .refine((v) => v.trim().length > 0, { message: "Token cannot be only whitespace" });

const bindingNameField = z
  .string()
  .trim()
  .min(1, "Binding name is required")
  .max(80, "Binding name is too long");

export const createAccountSchema = z.object({
  email: emailField,
  password: passwordField,
  role: z.enum(["member", "admin"]),
  bindingName: bindingNameField,
  bindingKind: z.enum(SUPPORTED_KINDS),
  bindingUrl: wsUrl,
  bindingToken: tokenField,
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
