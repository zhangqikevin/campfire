import fs from "node:fs/promises";
import path from "node:path";
import { generateSecureUuid } from "openclaw/plugin-sdk/infra-runtime";

export interface StoredApp {
  id: string;
  title: string;
  /** OpenUI Lang source — what the Renderer consumes. */
  content: string;
  /** The session-key that created this app. */
  sessionKey: string;
  /** agentId responsible for this app. */
  agentId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * File-backed app store. One JSON file per app in
 *   <state-dir>/plugins/campfire/apps/<id>.json
 *
 * Concurrency: write paths take a per-id mutex via a promise chain. Two
 * concurrent `update` calls on the same id serialize cleanly without losing
 * intermediate state.
 */
export class AppStore {
  private dir: string;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(stateDir: string) {
    this.dir = path.join(stateDir, "plugins", "campfire", "apps");
  }

  private filePath(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  /** Serialize all reads-modifies-writes through one chain to avoid races. */
  private serial<T>(op: () => Promise<T>): Promise<T> {
    const next = this.chain.then(op, op);
    this.chain = next.catch(() => undefined);
    return next;
  }

  async create(
    data: Omit<StoredApp, "id" | "createdAt" | "updatedAt">,
  ): Promise<StoredApp> {
    return this.serial(async () => {
      await this.ensureDir();
      const now = new Date().toISOString();
      const record: StoredApp = {
        id: generateSecureUuid(),
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      await fs.writeFile(this.filePath(record.id), JSON.stringify(record, null, 2), "utf-8");
      return record;
    });
  }

  async update(
    id: string,
    patch: Partial<Pick<StoredApp, "title" | "content">>,
  ): Promise<StoredApp> {
    return this.serial(async () => {
      const existing = await this.readOne(id);
      if (!existing) throw new Error(`App not found: ${id}`);
      const updated: StoredApp = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await fs.writeFile(this.filePath(id), JSON.stringify(updated, null, 2), "utf-8");
      return updated;
    });
  }

  private async readOne(id: string): Promise<StoredApp | null> {
    try {
      const raw = await fs.readFile(this.filePath(id), "utf-8");
      return JSON.parse(raw) as StoredApp;
    } catch {
      return null;
    }
  }

  async get(id: string): Promise<StoredApp | null> {
    return this.readOne(id);
  }

  async list(): Promise<StoredApp[]> {
    await this.ensureDir();
    let entries: string[];
    try {
      entries = await fs.readdir(this.dir);
    } catch {
      return [];
    }
    const records = await Promise.all(
      entries
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            return JSON.parse(await fs.readFile(path.join(this.dir, f), "utf-8")) as StoredApp;
          } catch {
            return null;
          }
        }),
    );
    return (records.filter(Boolean) as StoredApp[]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async delete(id: string): Promise<void> {
    return this.serial(async () => {
      try {
        await fs.unlink(this.filePath(id));
      } catch {
        // already gone
      }
    });
  }
}
