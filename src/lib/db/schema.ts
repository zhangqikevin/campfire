import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
});

// Org-internal-tool role. `member` is the default for every newly-created
// account; `admin` can manage other accounts and Team Apps via `/admin/*`.
// JWT carries the role for fast checks; cross-checked against the DB on
// admin-gated server actions because JWTs don't auto-invalidate on demote.
export const userRoleEnum = pgEnum("user_role", ["member", "admin"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    emailNormalizedUnique: uniqueIndex("users_email_normalized_unique").on(table.emailNormalized),
    tenantIdx: index("users_tenant_idx").on(table.tenantId),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];

// Agent bindings: metadata pointing at an external agent (OpenClaw gateway).
//
// Token storage trade-off — admin-provisioned org tool mode:
//   - Admin enters the agent's auth token when creating an account. The
//     server AES-256-GCM-encrypts it (key from CAMPFIRE_TOKEN_ENCRYPTION_KEY
//     env) and stores ciphertext + nonce here.
//   - On the account's first login, server decrypts and returns the token
//     to the browser, which stashes it in IndexedDB (browser-bridge from
//     that point on, as before).
//   - We keep the encrypted copy so an account that clears browser data /
//     uses a new device can re-fetch on next login.
//
// Storage as base64 text rather than `bytea` — Postgres accepts base64
// strings round-trip cleanly via Drizzle's text type and avoids the
// custom-type plumbing bytea needs. ~33% overhead is negligible for
// kilobyte-class tokens.
export const agentBindings = pgTable(
  "agent_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["openclaw", "hermes"] }).notNull(),
    url: text("url").notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    // Encrypted token + nonce (base64). Null when the binding hasn't been
    // provisioned with a token (e.g., legacy rows pre-admin-mode).
    tokenCiphertext: text("token_ciphertext"),
    tokenNonce: text("token_nonce"),
    tokenProvisionedAt: timestamp("token_provisioned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => sql`now()`),
  },
  (table) => ({
    tenantIdx: index("agent_bindings_tenant_idx").on(table.tenantId),
  }),
);

export type AgentBinding = typeof agentBindings.$inferSelect;
export type NewAgentBinding = typeof agentBindings.$inferInsert;

// Team Apps: organization-wide OpenUI Lang programs the admin maintains.
// Every account can render them but not modify. Deliberately NOT tenant-
// scoped — they're meant to be shared across the org. The Renderer's
// `toolProvider` still points at each account's own gateway at render
// time, so Query/Mutation data calls land in the account's per-session
// SQLite or run shell on the account's bound gateway — same template,
// per-account data.
export const teamApps = pgTable("team_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
});

export type TeamApp = typeof teamApps.$inferSelect;
export type NewTeamApp = typeof teamApps.$inferInsert;
