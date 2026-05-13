import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runDbExecute, runDbQuery } from "../src/db";

let stateDir: string;

beforeAll(() => {
  stateDir = mkdtempSync(path.join(tmpdir(), "campfire-plugin-test-"));
});

afterAll(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

describe("db_execute + db_query happy path", () => {
  it("creates a table, inserts a row, reads it back", async () => {
    await runDbExecute(stateDir, {
      sql: "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, label TEXT)",
    });
    const inserted = await runDbExecute(stateDir, {
      sql: "INSERT INTO items (label) VALUES ($label)",
      params: { label: "first" },
    });
    expect(inserted.changes).toBe(1);
    expect(inserted.lastInsertRowid).toBe(1);

    const result = await runDbQuery(stateDir, { sql: "SELECT id, label FROM items" });
    expect(result.rows).toEqual([{ id: 1, label: "first" }]);
  });
});

describe("PRAGMA query_only=ON enforces read-only at the kernel level", () => {
  it("rejects an INSERT routed through db_query", async () => {
    await runDbExecute(stateDir, {
      sql: "CREATE TABLE IF NOT EXISTS qo (id INTEGER PRIMARY KEY)",
    });
    await expect(
      runDbQuery(stateDir, { sql: "INSERT INTO qo (id) VALUES (1)" }),
    ).rejects.toThrow();
  });

  it("rejects an UPDATE routed through db_query", async () => {
    await runDbExecute(stateDir, {
      sql: "CREATE TABLE IF NOT EXISTS qo2 (id INTEGER PRIMARY KEY)",
    });
    await runDbExecute(stateDir, { sql: "INSERT INTO qo2 (id) VALUES (1)" });
    await expect(
      runDbQuery(stateDir, { sql: "UPDATE qo2 SET id = 2 WHERE id = 1" }),
    ).rejects.toThrow();
  });

  it("denies actual writes against sqlite_master even after PRAGMA writable_schema=1", async () => {
    // openclaw-os-plugin's syntactic only-allow-SELECT/WITH/PRAGMA/EXPLAIN
    // check let any PRAGMA through. The danger of PRAGMA writable_schema=1
    // is what it ENABLES — direct INSERT/DELETE on sqlite_master.
    //
    // query_only=ON doesn't reject the PRAGMA itself (it's not a write), but
    // it DOES reject the actual schema mutation that PRAGMA would normally
    // enable. Combined with our per-call open+close, the flag never persists
    // long enough to chain, so the attack is closed.
    await expect(
      runDbQuery(stateDir, { sql: "PRAGMA writable_schema=1" }),
    ).resolves.toBeDefined();
    await expect(
      runDbQuery(stateDir, {
        sql: "DELETE FROM sqlite_master WHERE name = 'qo'",
      }),
    ).rejects.toThrow();
  });

  it("still allows SELECT and pure-read PRAGMAs", async () => {
    const r = await runDbQuery(stateDir, { sql: "PRAGMA journal_mode" });
    expect(Array.isArray(r.rows)).toBe(true);
  });
});

describe("namespace isolation", () => {
  it("uses separate SQLite files per namespace", async () => {
    await runDbExecute(stateDir, {
      sql: "CREATE TABLE IF NOT EXISTS x (n INTEGER)",
      namespace: "ns1",
    });
    await runDbExecute(stateDir, { sql: "INSERT INTO x VALUES (1)", namespace: "ns1" });

    // ns2 should not see ns1's table.
    await expect(
      runDbQuery(stateDir, { sql: "SELECT n FROM x", namespace: "ns2" }),
    ).rejects.toThrow();
  });

  it("sanitizes path-traversal attempts in namespace", async () => {
    // Slashes get replaced with `_`; the leading `..` run gets replaced with
    // a single `_` so the resulting filename can't begin with `.` (hidden
    // file) or `-` (flag-like). The `..` in the middle is just two literal
    // dots in a filename — doesn't traverse anywhere.
    const r = await runDbExecute(stateDir, {
      sql: "CREATE TABLE IF NOT EXISTS sanitized (n INTEGER)",
      namespace: "../../etc/passwd",
    });
    expect(r.namespace).toBe("__.._etc_passwd");
    expect(r.namespace).not.toMatch(/^[.-]/);
    expect(r.namespace).not.toContain("/");
  });
});
