/** The ignore file that keeps Mokly's private cache out of Git. */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** Name of the ignore file directly inside `.mokly-cache/`. */
const CACHE_IGNORE_FILE = ".gitignore";

/** Git rules that match every cache path, the ignore file itself included. */
const CACHE_IGNORE_TEXT = "# Created by Mokly automatically.\n*\n";

/** File operations the ignore file needs; `stat` never follows a link. */
export interface CacheIgnoreFileSystem {
  stat(file: string): Promise<object | undefined>;
  /** Create `file` exclusively. */
  write(file: string, bytes: Uint8Array, mode?: number): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(file: string): Promise<void>;
}

const localFiles: CacheIgnoreFileSystem = {
  async stat(file) {
    try {
      return await fs.lstat(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  },
  write: (file, bytes, mode) => fs.writeFile(file, bytes, { flag: "wx", mode }),
  rename: (from, to) => fs.rename(from, to),
  remove: (file) => fs.rm(file, { force: true }),
};

/**
 * Publish the ignore file in the existing `cache` directory unless an entry
 * already has its name, so an edited file stays. The bytes are written to a
 * temporary file and renamed into place, so an interrupted write never leaves
 * a partial ignore file that later runs would keep. Concurrent writers
 * publish identical bytes.
 */
export async function ensureCacheIgnore(
  files: CacheIgnoreFileSystem,
  cache: string,
): Promise<void> {
  const target = path.join(cache, CACHE_IGNORE_FILE);
  if (await files.stat(target)) return;
  const temporary = path.join(cache, `${CACHE_IGNORE_FILE}-${randomUUID()}`);
  try {
    await files.write(temporary, Buffer.from(CACHE_IGNORE_TEXT), 0o644);
    await files.rename(temporary, target);
  } catch (error) {
    if (!(await files.stat(target))) throw error;
  } finally {
    await files.remove(temporary);
  }
}

/**
 * Create the local `cache` directory when it is missing, then its ignore file.
 * A symbolic link gets no ignore file, because Git does not read ignore files
 * through a link.
 */
export async function prepareCacheDirectory(cache: string): Promise<void> {
  await fs.mkdir(cache, { recursive: true });
  if ((await fs.lstat(cache)).isDirectory())
    await ensureCacheIgnore(localFiles, cache);
}
