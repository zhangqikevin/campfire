import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  // Keep a single pool across Next.js hot-reloads in dev to avoid
  // exhausting Postgres's connection limit.
  // eslint-disable-next-line no-var
  var __campfirePgPool: Pool | undefined;
}

const pool =
  globalThis.__campfirePgPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

if (env.NODE_ENV !== "production") {
  globalThis.__campfirePgPool = pool;
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;
