import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Display form, as the user entered it.
    email: text("email").notNull(),
    // Lowercased + trimmed form, used for uniqueness and lookups. Storing both
    // lets us preserve user-entered casing for display while still preventing
    // duplicate-by-case-only signups (Alice@x vs alice@x).
    emailNormalized: text("email_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
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

// Agent bindings: metadata pointing at an external agent (OpenClaw gateway,
// later Hermes endpoint, …). We deliberately DO NOT store the auth token —
// that lives in the user's browser (IndexedDB) and is only ever seen by the
// browser-bridge code path. Server-side compromise leaks URLs, not creds.
export const agentBindings = pgTable(
  "agent_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["openclaw", "hermes"] }).notNull(),
    // ws:// or wss:// for openclaw; HTTPS endpoint for hermes (later).
    url: text("url").notNull(),
    // Last time the browser successfully opened the connection. Null = never
    // verified (just created, or verification failed).
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
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
