import fs from "node:fs";
import path from "node:path";

import { isInside } from "../config/paths.js";

/** Track directory changes so output moves and failed installs leave no stale tree. */
export class OutputDirectories {
  private readonly removed = new Map<string, number>();
  private readonly created: string[] = [];
  constructor(private readonly root: string) {}

  /** Remove only empty ancestors of backed-up files, stopping at the output root. */
  async prune(
    routes: readonly string[],
    expected: readonly string[],
  ): Promise<void> {
    const retained = new Set<string>();
    for (const route of expected) {
      let directory = path.dirname(path.join(this.root, route));
      while (directory !== this.root && isInside(this.root, directory)) {
        retained.add(directory);
        directory = path.dirname(directory);
      }
    }
    for (const route of routes) {
      let directory = path.dirname(path.join(this.root, route));
      while (
        directory !== this.root &&
        isInside(this.root, directory) &&
        !retained.has(directory)
      ) {
        try {
          const stats = await fs.promises.lstat(directory);
          if (!stats.isDirectory()) break;
          await fs.promises.rmdir(directory);
          this.removed.set(directory, stats.mode);
        } catch (cause) {
          const code = errorCode(cause);
          if (code === "ENOTEMPTY" || code === "EEXIST") break;
          if (code !== "ENOENT") throw cause;
        }
        directory = path.dirname(directory);
      }
    }
  }

  /** Create installation parents individually, recording exactly the new directories. */
  async ensure(parent: string): Promise<void> {
    await fs.promises.mkdir(this.root, { recursive: true });
    const parts = path
      .relative(this.root, parent)
      .split(path.sep)
      .filter(Boolean);
    let directory = this.root;
    for (const part of parts) {
      directory = path.join(directory, part);
      try {
        await fs.promises.mkdir(directory);
        this.created.push(directory);
      } catch (cause) {
        if (errorCode(cause) !== "EEXIST") throw cause;
      }
    }
  }

  /** Undo only tracked changes; unrelated authored files and the output root remain. */
  async restore(): Promise<void> {
    for (const directory of [...this.created].reverse()) {
      try {
        await fs.promises.rmdir(directory);
      } catch (cause) {
        if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(errorCode(cause) ?? ""))
          throw cause;
      }
    }
    for (const [directory, mode] of [...this.removed].sort(
      ([a], [b]) => a.length - b.length,
    ))
      await fs.promises.mkdir(directory, { recursive: true, mode });
  }
}

function errorCode(cause: unknown): string | undefined {
  return cause !== null &&
    typeof cause === "object" &&
    "code" in cause &&
    typeof cause.code === "string"
    ? cause.code
    : undefined;
}
