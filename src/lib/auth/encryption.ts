import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

// AES-256-GCM token-at-rest encryption.
//
// Used for agent_bindings.token_ciphertext — admin enters the user's
// gateway token at account-creation time, Campfire encrypts it with the
// master key (CAMPFIRE_TOKEN_ENCRYPTION_KEY), stores it. On the account's
// first login, server decrypts and hands the plaintext to the browser,
// which stashes it in IndexedDB. After that the browser is the source of
// truth at runtime — server-side copy stays as backup for re-login from
// a different browser / cleared storage.
//
// Key handling:
//   - Master key is a 32-byte (256-bit) AES key, base64-encoded in the env.
//   - Each token gets a fresh 96-bit IV (recommended length for GCM).
//   - The 128-bit auth tag is appended to the ciphertext for storage; we
//     split it back off before decrypting.
//
// Losing the master key invalidates ALL stored tokens (no recovery path).
// Rotating the key requires re-encrypting every row — out of scope here.

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = env.CAMPFIRE_TOKEN_ENCRYPTION_KEY;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `CAMPFIRE_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes ` +
        `(got ${buf.length}). Generate with: openssl rand -base64 32`,
    );
  }
  cachedKey = buf;
  return buf;
}

export interface EncryptedToken {
  /** base64; ciphertext with the GCM auth tag appended (last 16 bytes). */
  ciphertext: string;
  /** base64; 12-byte IV. */
  nonce: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptToken: plaintext must be a non-empty string");
  }
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([ct, tag]);
  return {
    ciphertext: combined.toString("base64"),
    nonce: iv.toString("base64"),
  };
}

export function decryptToken(encrypted: EncryptedToken): string {
  const combined = Buffer.from(encrypted.ciphertext, "base64");
  const iv = Buffer.from(encrypted.nonce, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error(`decryptToken: nonce must be ${IV_LENGTH} bytes (got ${iv.length})`);
  }
  if (combined.length < TAG_LENGTH) {
    throw new Error("decryptToken: ciphertext too short — auth tag missing");
  }
  const key = getMasterKey();
  const ct = combined.subarray(0, combined.length - TAG_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf-8");
}

/**
 * Smoke-checks the configured master key is the right shape. Call at
 * startup (or during a /admin/health probe) so a misconfigured key fails
 * loud rather than at the first token-decrypt attempt.
 */
export function assertEncryptionKeyValid(): void {
  getMasterKey();
}
