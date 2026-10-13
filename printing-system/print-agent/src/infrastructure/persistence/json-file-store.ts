import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * A small durable key-value-ish JSON file store. Reads/writes the
 * entire document as one JSON blob, with writes serialized (so
 * concurrent callers within this single process never interleave)
 * and made atomic via write-to-temp-then-rename.
 *
 * This is intentionally simple: the queue/printer/identity datasets
 * an agent manages are small (dozens to low hundreds of records), so
 * a single JSON file avoids a native dependency (e.g. better-sqlite3)
 * that can be awkward to prebuild for a Raspberry Pi Zero 2 W target.
 * The repository interfaces in `domain/repositories` do not leak this
 * choice -- swapping in a SQLite-backed implementation later only
 * requires a new class satisfying the same interface.
 */
export class JsonFileStore<T> {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T
  ) {}

  async read(): Promise<T> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as T;
    } catch (err) {
      if (isNotFound(err)) {
        return this.defaultValue;
      }
      throw err;
    }
  }

  /** Serializes writes so overlapping callers never corrupt the file. */
  async write(value: T): Promise<void> {
    const next = this.writeChain.then(() => this.writeAtomic(value));
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  private async writeAtomic(value: T): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), "utf-8");
    await fs.rename(tmpPath, this.filePath);
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT";
}
