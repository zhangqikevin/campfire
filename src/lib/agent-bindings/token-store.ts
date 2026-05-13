/**
 * Browser-only IndexedDB store for agent tokens. The token never leaves the
 * browser — Campfire's server stores only the binding metadata (URL, name,
 * kind), so a server-side compromise does not leak agent credentials.
 *
 * Keyed by the server-issued binding id (uuid). Token is stored as plaintext
 * inside IDB; browser extensions and same-origin XSS can read it, which is the
 * inherent risk of the browser-bridge model and the reason we'll layer a
 * strict CSP on the served pages.
 */

const DB_NAME = "campfire";
const DB_VERSION = 1;
const STORE_NAME = "agent_tokens";

interface TokenRecord {
  bindingId: string;
  token: string;
  storedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "bindingId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const req = action(tx.objectStore(STORE_NAME));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
      }),
  );
}

export async function saveToken(bindingId: string, token: string): Promise<void> {
  if (!isBrowser()) throw new Error("token-store only works in the browser");
  const record: TokenRecord = {
    bindingId,
    token,
    storedAt: new Date().toISOString(),
  };
  await run<IDBValidKey>("readwrite", (store) => store.put(record));
}

export async function getToken(bindingId: string): Promise<string | null> {
  if (!isBrowser()) return null;
  const record = await run<TokenRecord | undefined>("readonly", (store) => store.get(bindingId));
  return record?.token ?? null;
}

export async function deleteToken(bindingId: string): Promise<void> {
  if (!isBrowser()) return;
  await run<undefined>("readwrite", (store) => store.delete(bindingId));
}

export async function hasToken(bindingId: string): Promise<boolean> {
  return (await getToken(bindingId)) !== null;
}
