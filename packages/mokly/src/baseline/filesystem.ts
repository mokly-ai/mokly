import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  StderrBaselineMaintenanceReporter,
  type BaselineMaintenanceReporter,
} from "./maintenance.js";
import type {
  BaselineFileSystem,
  BaselineLockIdentity,
  BaselineStat,
} from "./types.js";

/** Local files without link following; lock contents are published atomically. */
export class NodeBaselineFileSystem implements BaselineFileSystem {
  constructor(
    private readonly maintenance: BaselineMaintenanceReporter = new StderrBaselineMaintenanceReporter(),
  ) {}

  async stat(file: string): Promise<BaselineStat | undefined> {
    try {
      const stat = await fs.lstat(file, { bigint: true });
      return {
        kind: stat.isSymbolicLink()
          ? "symlink"
          : stat.isFile()
            ? "regular"
            : stat.isDirectory()
              ? "directory"
              : "other",
        size: Number(stat.size),
        identity: `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`,
      };
    } catch (error) {
      if (hasCode(error, "ENOENT")) return;
      throw error;
    }
  }

  async list(directory: string): Promise<readonly string[]> {
    return (await fs.readdir(directory)).sort();
  }

  async read(file: string, maxBytes: number): Promise<Uint8Array> {
    const handle = await fs.open(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const stat = await handle.stat();
      if (!stat.isFile())
        throw new Error(`Not a regular baseline file: ${file}`);
      if (stat.size > maxBytes)
        throw new Error(`Baseline file exceeds ${maxBytes} bytes: ${file}`);
      const chunks: Buffer[] = [];
      let count = 0;
      while (true) {
        const buffer = Buffer.alloc(Math.min(64 * 1024, maxBytes - count + 1));
        const { bytesRead } = await handle.read(buffer);
        if (!bytesRead) break;
        count += bytesRead;
        if (count > maxBytes)
          throw new Error(`Baseline file exceeds ${maxBytes} bytes: ${file}`);
        chunks.push(buffer.subarray(0, bytesRead));
      }
      return Buffer.concat(chunks);
    } finally {
      await handle.close();
    }
  }

  async write(file: string, bytes: Uint8Array, mode = 0o600): Promise<void> {
    await fs.writeFile(file, bytes, { flag: "wx", mode });
  }

  async mkdir(directory: string): Promise<void> {
    try {
      await fs.mkdir(directory, { mode: 0o700 });
    } catch (error) {
      if (
        !hasCode(error, "EEXIST") ||
        (await this.stat(directory))?.kind !== "directory"
      )
        throw error;
    }
  }

  async remove(file: string): Promise<void> {
    await fs.rm(file, { recursive: true, force: true });
  }

  async rename(from: string, to: string): Promise<void> {
    await fs.rename(from, to);
  }
  async symlink(target: string, file: string): Promise<void> {
    await fs.symlink(target, file);
  }

  async acquireLock(
    file: string,
    bytes: Uint8Array,
  ): Promise<BaselineLockIdentity | undefined> {
    const temporary = path.join(
      path.dirname(file),
      `.lock-${process.pid}-${randomUUID()}`,
    );
    await this.write(temporary, bytes);
    try {
      const stat = await this.stat(temporary);
      if (stat?.kind !== "regular")
        throw new Error(`Not a regular baseline lock: ${temporary}`);
      await fs.link(temporary, file);
      return { identity: stat.identity };
    } catch (error) {
      if (hasCode(error, "EEXIST")) return;
      throw error;
    } finally {
      try {
        await this.remove(temporary);
      } catch (error) {
        this.maintenance.report({ entry: temporary, error });
      }
    }
  }

  async reclaimLock(file: string, identity: string): Promise<boolean> {
    if ((await this.stat(file))?.identity !== identity) return false;
    const retired = `${file}.retired-${createHash("sha256").update(identity).digest("hex")}`;
    try {
      await fs.link(file, retired);
    } catch (error) {
      if (hasCode(error, "EEXIST") || hasCode(error, "ENOENT")) return false;
      throw error;
    }
    if (
      (await this.stat(retired))?.identity !== identity ||
      (await this.stat(file))?.identity !== identity
    )
      return false;
    await this.remove(file);
    return true;
  }
}

function hasCode(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException).code === code;
}
