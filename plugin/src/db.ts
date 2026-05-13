import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// node:sqlite is a Node 22.5+ built-in. We import via createRequire instead of
// a static `import { DatabaseSync } from "node:sqlite"` because Vite 5's
// transform doesn't yet treat `node:sqlite` as a known built-in and tries to
// resolve it from npm at test/dev time. createRequire bypasses the Vite
// transform pipeline entirely and goes straight to Node's loader, which
// always knows about `node:sqlite`. Runtime semantics are identical.
const requireFromHere = createRequire(import.meta.url);
const { DatabaseSync } = requireFromHere("node:sqlite") as typeof import("node:sqlite");

/**
 * Per-namespace SQLite at <state-dir>/plugins/campfire/db/<namespace>.sqlite.
 *
 * Two key safety details relative to openclaw-os-plugin's equivalent:
 *
 * 1. Read-only queries open a SECOND connection with `PRAGMA query_only=ON`.
 *    SQLite refuses any write at the kernel level on this connection, so a
 *    misclassified statement (or a CTE with DELETE...RETURNING) can't sneak
 *    through. openclaw-os relied on a syntactic prefix check, which allowed
 *    e.g. `PRAGMA writable_schema=1` — fixed here at the engine level.
 *
 * 2. Connections are opened+closed per call (not pooled). WAL + same-file
 *    concurrent opens are safe, and this avoids state leaks if a query
 *    misbehaves. The cost is small; revisit if profiling shows it matters.
 */
function sanitizeNamespace(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "default";
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  // Reject leading `.` or `-` so the resulting filename can't shadow a hidden
  // file (.sqlite) or be misread as a CLI flag.
  const safe = cleaned.replace(/^[.-]+/, "_");
  return safe || "default";
}

function normalizeParams(value: unknown): unknown[] | Record<string, unknown> {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return [];
}

function runStatement<T>(
  statement: unknown,
  mode: "all" | "get" | "run",
  params: unknown,
): T {
  const stmt = statement as {
    setAllowBareNamedParameters?: (allow: boolean) => void;
    all: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    run: (...args: unknown[]) => unknown;
  };
  stmt.setAllowBareNamedParameters?.(true);
  const normalized = normalizeParams(params);
  if (Array.isArray(normalized)) return stmt[mode](...normalized) as T;
  if (Object.keys(normalized).length === 0) return stmt[mode]() as T;
  return stmt[mode](normalized) as T;
}

async function dbPath(stateDir: string, namespace: string): Promise<string> {
  const dir = path.join(stateDir, "plugins", "campfire", "db");
  await mkdir(dir, { recursive: true });
  return path.join(dir, `${namespace}.sqlite`);
}

export interface DbQueryArgs {
  sql: string;
  params?: unknown;
  namespace?: unknown;
}

export interface DbExecuteArgs extends DbQueryArgs {}

export interface DbQueryResult {
  namespace: string;
  rows: unknown[];
}

export interface DbExecuteResult {
  namespace: string;
  changes: number;
  lastInsertRowid: number | null;
}

export async function runDbQuery(
  stateDir: string,
  args: DbQueryArgs,
): Promise<DbQueryResult> {
  const sql = typeof args.sql === "string" ? args.sql.trim() : "";
  if (!sql) throw new Error("db_query requires a non-empty 'sql' argument");

  const namespace = sanitizeNamespace(args.namespace);
  const file = await dbPath(stateDir, namespace);
  const db = new DatabaseSync(file);

  try {
    // WAL for concurrent reads/writes across handles.
    db.exec("PRAGMA journal_mode = WAL;");
    // ALL writes from this handle fail with `attempt to write a readonly
    // database` — kernel-level enforcement, no syntax parsing involved.
    db.exec("PRAGMA query_only = ON;");

    const statement = db.prepare(sql);
    const result = runStatement<unknown[]>(statement, "all", args.params);
    return { namespace, rows: Array.isArray(result) ? result : [] };
  } finally {
    db.close();
  }
}

export async function runDbExecute(
  stateDir: string,
  args: DbExecuteArgs,
): Promise<DbExecuteResult> {
  const sql = typeof args.sql === "string" ? args.sql.trim() : "";
  if (!sql) throw new Error("db_execute requires a non-empty 'sql' argument");

  const namespace = sanitizeNamespace(args.namespace);
  const file = await dbPath(stateDir, namespace);
  const db = new DatabaseSync(file);

  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");

    const normalizedParams = normalizeParams(args.params);
    const hasParams = Array.isArray(normalizedParams)
      ? normalizedParams.length > 0
      : Object.keys(normalizedParams).length > 0;

    if (hasParams) {
      const statement = db.prepare(sql);
      const result = runStatement<{
        changes?: number;
        lastInsertRowid?: number | bigint;
      }>(statement, "run", normalizedParams);
      return {
        namespace,
        changes: Number(result?.changes ?? 0),
        lastInsertRowid:
          result?.lastInsertRowid != null ? Number(result.lastInsertRowid) : null,
      };
    }

    db.exec(sql);
    const meta = db
      .prepare("SELECT changes() AS changes, last_insert_rowid() AS lastInsertRowid")
      .get() as { changes?: number; lastInsertRowid?: number | bigint } | null;
    return {
      namespace,
      changes: Number(meta?.changes ?? 0),
      lastInsertRowid: meta?.lastInsertRowid != null ? Number(meta.lastInsertRowid) : null,
    };
  } finally {
    db.close();
  }
}
