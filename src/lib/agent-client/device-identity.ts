// Per-binding ed25519 keypair stored in IndexedDB. The keypair signs the
// connect handshake payload (proves to the gateway that this browser owns
// the device), and never leaves IDB. Each binding gets its own key so:
//   - clearing one binding doesn't compromise other bindings
//   - the gateway sees distinct deviceIds for distinct campfire sessions
//
// Storage: separate IDB database from the token store so they can be opened
// independently without coordinating onupgradeneeded migrations.

import * as ed from "@noble/ed25519";
import { sha256, sha512 } from "@noble/hashes/sha2";

// @noble/ed25519 v2 requires a SHA-512 implementation to be plugged in.
ed.etc.sha512Sync = sha512;

const DB_NAME = "campfire-devices";
const DB_VERSION = 1;
const STORE_NAME = "agent_devices";

export interface DeviceIdentity {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  /** sha-256 hex of the public key. */
  deviceId: string;
  /** Set after the first successful hello-ok; preferred for subsequent connects. */
  deviceToken: string | null;
}

interface StoredRecord {
  bindingId: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  deviceToken?: string;
}

function isBrowser(): boolean {
  return typeof indexedDB !== "undefined";
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
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
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

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getOrCreateDeviceIdentity(bindingId: string): Promise<DeviceIdentity> {
  if (!isBrowser()) throw new Error("device-identity is browser-only");

  let record = await run<StoredRecord | undefined>("readonly", (store) => store.get(bindingId));

  if (!record) {
    const privateKey = ed.utils.randomPrivateKey();
    const publicKey = await ed.getPublicKey(privateKey);
    record = { bindingId, privateKey, publicKey };
    await run<IDBValidKey>("readwrite", (store) => store.put(record));
  }

  return {
    privateKey: record.privateKey,
    publicKey: record.publicKey,
    deviceId: toHex(sha256(record.publicKey)),
    deviceToken: record.deviceToken ?? null,
  };
}

export async function saveDeviceToken(bindingId: string, deviceToken: string): Promise<void> {
  const record = await run<StoredRecord | undefined>("readonly", (store) => store.get(bindingId));
  if (!record) return;
  await run<IDBValidKey>("readwrite", (store) =>
    store.put({ ...record, deviceToken }),
  );
}

export async function clearDeviceToken(bindingId: string): Promise<void> {
  const record = await run<StoredRecord | undefined>("readonly", (store) => store.get(bindingId));
  if (!record) return;
  const { deviceToken: _drop, ...rest } = record;
  void _drop;
  await run<IDBValidKey>("readwrite", (store) => store.put(rest));
}

export async function deleteDeviceIdentity(bindingId: string): Promise<void> {
  if (!isBrowser()) return;
  await run<undefined>("readwrite", (store) => store.delete(bindingId));
}

export async function signMessage(message: string, privateKey: Uint8Array): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(message);
  return ed.sign(bytes, privateKey);
}
