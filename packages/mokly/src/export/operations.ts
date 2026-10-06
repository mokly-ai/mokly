import fs from "node:fs";

import { renameExclusive } from "./rename.js";

/** Filesystem mutation boundary; recursive removal is only for private stages. */
export interface ExportOperations {
  lstat(candidate: string): Promise<fs.BigIntStats | undefined>;
  /** Atomic no-replace move; must fail if any destination entry exists. */
  rename(from: string, to: string): Promise<void>;
  remove(candidate: string): Promise<void>;
  unlink(candidate: string): Promise<void>;
  rmdir(candidate: string): Promise<void>;
}

/** Exclusive native moves and non-recursive backup cleanup operations. */
export const fileExportOperations: ExportOperations = {
  lstat: async (candidate) => {
    try {
      return await fs.promises.lstat(candidate, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  },
  rename: renameExclusive,
  remove: (candidate) =>
    fs.promises.rm(candidate, { recursive: true, force: true }),
  unlink: (candidate) => fs.promises.unlink(candidate),
  rmdir: (candidate) => fs.promises.rmdir(candidate),
};
