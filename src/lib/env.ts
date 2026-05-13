import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (v) => v.startsWith("postgresql://") || v.startsWith("postgres://"),
      { message: "DATABASE_URL must start with postgresql:// or postgres://" },
    ),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars (openssl rand -base64 32)"),
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
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
