import path from "node:path";

import type {
  BaselineFileSystem,
  BaselineLockIdentity,
  BaselineStat,
} from "../../packages/mokly/dist/baseline/types.js";

interface MemoryFile extends BaselineStat {
  bytes: Uint8Array;
  target?: string;
}

/** Unit-test filesystem; operations never touch the host disk. */
export class MemoryBaselineFileSystem implements BaselineFileSystem {
  readonly files = new Map<string, MemoryFile>();
  readonly reads: string[] = [];
  private next = 0;
  constructor() {
    this.put("/repo", "directory");
  }
  put(
    file: string,
    kind: BaselineStat["kind"],
    bytes: Uint8Array = Buffer.alloc(0),
    size = bytes.byteLength,
  ): void {
    this.files.set(file, { kind, bytes, size, identity: String(++this.next) });
  }
  async stat(file: string): Promise<BaselineStat | undefined> {
    return this.files.get(file);
  }
  async list(directory: string): Promise<readonly string[]> {
    return [...this.files.keys()]
      .filter((file) => path.dirname(file) === directory && file !== directory)
      .map((file) => path.basename(file))
      .sort();
  }
  async read(file: string, maxBytes: number): Promise<Uint8Array> {
    this.reads.push(file);
    const data = this.files.get(file);
    if (data?.kind !== "regular" || data.size > maxBytes)
      throw new Error(`Invalid read: ${file}`);
    return data.bytes;
  }
  async write(file: string, bytes: Uint8Array): Promise<void> {
    if (
      this.files.has(file) ||
      this.files.get(path.dirname(file))?.kind !== "directory"
    )
      throw new Error(`Invalid write: ${file}`);
    this.put(file, "regular", bytes);
  }
  async mkdir(directory: string): Promise<void> {
    if (!this.files.has(directory)) this.put(directory, "directory");
    if (this.files.get(directory)?.kind !== "directory")
      throw new Error("Not a directory");
  }
  async remove(file: string): Promise<void> {
    for (const name of this.files.keys())
      if (name === file || name.startsWith(`${file}/`)) this.files.delete(name);
  }
  async rename(from: string, to: string): Promise<void> {
    if (!this.files.has(from) || this.files.has(to))
      throw new Error(`Invalid move: ${from} -> ${to}`);
    const entries = [...this.files].filter(
      ([name]) => name === from || name.startsWith(`${from}/`),
    );
    for (const [name, entry] of entries) {
      this.files.delete(name);
      this.files.set(to + name.slice(from.length), entry);
    }
  }
  async symlink(target: string, file: string): Promise<void> {
    this.put(file, "symlink");
    this.files.get(file)!.target = target;
  }
  async acquireLock(
    file: string,
    bytes: Uint8Array,
  ): Promise<BaselineLockIdentity | undefined> {
    if (this.files.has(file)) return;
    this.put(file, "regular", bytes);
    return { identity: this.files.get(file)!.identity };
  }
  async reclaimLock(file: string, identity: string): Promise<boolean> {
    if (this.files.get(file)?.identity !== identity) return false;
    this.files.delete(file);
    return true;
  }
}
