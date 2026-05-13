import { z } from "zod";

// Only "openclaw" is fully wired up for the MVP. The kind column exists in
// the DB so future Hermes / other adapters slot in without schema migration,
// but the form validator rejects anything else for now.
export const SUPPORTED_KINDS = ["openclaw"] as const;
export type AgentKind = (typeof SUPPORTED_KINDS)[number];

const wsUrl = z
  .string()
  .trim()
  .min(1, "URL is required")
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

export const createBindingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  url: wsUrl,
  kind: z.enum(SUPPORTED_KINDS),
});

export type CreateBindingInput = z.infer<typeof createBindingSchema>;

// Browser-side: also need to validate the token before stashing in IndexedDB.
// We don't enforce a max length — openclaw tokens are reasonably long — but
// reject empty / whitespace.
export const tokenSchema = z
  .string()
  .min(1, "Token is required")
  .max(8192, "Token is too long")
  .refine((v) => v.trim().length > 0, { message: "Token cannot be only whitespace" });
