import fs from "node:fs/promises";
import path from "node:path";
import { generateSecureUuid } from "openclaw/plugin-sdk/infra-runtime";

export interface StoredArtifact {
  id: string;
  kind: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  source: { agentId: string; sessionKey: string };
  createdAt: string;
  updatedAt: string;
}

export class ArtifactStore {
  private dir: string;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(stateDir: string) {
    this.dir = path.join(stateDir, "plugins", "campfire", "artifacts");
  }

  private filePath(id: string): string {
    return path.join(this.dir, `${id}.json`);
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private serial<T>(op: () => Promise<T>): Promise<T> {
    const next = this.chain.then(op, op);
    this.chain = next.catch(() => undefined);
    return next;
  }

  async create(
    data: Omit<StoredArtifact, "id" | "createdAt" | "updatedAt">,
  ): Promise<StoredArtifact> {
    return this.serial(async () => {
      await this.ensureDir();
      const now = new Date().toISOString();
      const record: StoredArtifact = {
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
    patch: Partial<Pick<StoredArtifact, "title" | "content" | "metadata">>,
  ): Promise<StoredArtifact> {
    return this.serial(async () => {
      const existing = await this.get(id);
      if (!existing) throw new Error(`Artifact not found: ${id}`);
      const updated: StoredArtifact = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await fs.writeFile(this.filePath(id), JSON.stringify(updated, null, 2), "utf-8");
      return updated;
    });
  }

  async get(id: string): Promise<StoredArtifact | null> {
    try {
      const raw = await fs.readFile(this.filePath(id), "utf-8");
      return JSON.parse(raw) as StoredArtifact;
    } catch {
      return null;
    }
  }

  async list(kind?: string): Promise<StoredArtifact[]> {
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
            return JSON.parse(
              await fs.readFile(path.join(this.dir, f), "utf-8"),
            ) as StoredArtifact;
          } catch {
            return null;
          }
        }),
    );
    const all = (records.filter(Boolean) as StoredArtifact[]).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return kind ? all.filter((a) => a.kind === kind) : all;
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
