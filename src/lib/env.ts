import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
      { message: "DATABASE_URL must start with postgresql:// or postgres://" },
    ),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET must be at least 32 chars (openssl rand -base64 32)"),
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  // AES-256-GCM key for encrypting agent_bindings tokens at rest. Required
  // because admin provisions tokens during account creation and the server
  // needs to hand them back to the account's browser on first login.
  // 32 bytes, base64-encoded. Generate with: openssl rand -base64 32
  CAMPFIRE_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(1, "CAMPFIRE_TOKEN_ENCRYPTION_KEY is required (openssl rand -base64 32)")
    .refine(
      (v) => {
        try {
          return Buffer.from(v, "base64").length === 32;
        } catch {
          return false;
        }
      },
      {
        message: "CAMPFIRE_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes",
      },
    ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const flattened = parsed.error.flatten().fieldErrors;
  const message = Object.entries(flattened)
    .map(([key, errors]) => `  ${key}: ${(errors ?? []).join(", ")}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${message}`);
}

export const env = parsed.data;
