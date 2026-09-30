import path from "node:path";

import { errorMessage, isCancellation } from "../errors.js";

import {
  assertDestination,
  type ExportDirectoryIdentity,
} from "./destination.js";
import { exportError } from "./error.js";
import type { ExportOperations } from "./operations.js";
import {
  assertExportOwnership,
  EXPORT_MARKER,
  type LegacyExportOwnership,
} from "./ownership.js";

/** Recovery and deletion policy for a captured, potentially concurrently edited output. */
export class ExportBackup {
  constructor(
    private readonly output: string,
    private readonly backup: string,
    private readonly operations: ExportOperations,
    private readonly legacy: LegacyExportOwnership | undefined,
  ) {}

  /** Validate the tree actually moved, not only the destination observed earlier. */
  async validate(initial: ExportDirectoryIdentity): Promise<void> {
    if (!(await assertExportOwnership(this.backup, this.legacy)))
      throw exportError(
        `Export backup disappeared before installation: ${this.backup}.`,
      );
    await assertDestination(this.backup, initial, this.operations);
  }

  /** Restore real directories with OS-enforced exclusion of new destinations. */
  async restore(primary: unknown): Promise<never> {
    try {
      if (await this.operations.lstat(this.output))
        throw exportError(
          `Export destination was recreated; it was not replaced: ${this.output}.`,
        );
      const stat = await this.operations.lstat(this.backup);
      if (!stat?.isDirectory() || stat.isSymbolicLink())
        throw exportError(
          `Export backup is not a real directory; recover it manually: ${this.backup}.`,
        );
      await this.operations.rename(this.backup, this.output);
    } catch (rollback) {
      throw exportError(
        `Export rollback failed; recover the previous site from ${this.backup}. Original failure: ${errorMessage(primary)} Recovery failure: ${errorMessage(rollback)}`,
        new AggregateError([primary, rollback]),
      );
    }
    throw exportError(
      `Could not install export; the previous output was restored. ${errorMessage(primary)}`,
      primary,
      { cancelled: isCancellation(primary) },
    );
  }

  /** Delete only a validated snapshot; new files make non-recursive removal fail. */
  async discard(): Promise<void> {
    try {
      const entries = await assertExportOwnership(this.backup, this.legacy);
      if (!entries)
        throw exportError(
          `Export backup disappeared during cleanup: ${this.backup}.`,
        );
      const marker =
        this.legacy && entries.files.includes(this.legacy.marker)
          ? this.legacy.marker
          : EXPORT_MARKER;
      for (const name of entries.files.filter((name) => name !== marker))
        await this.operations.unlink(path.join(this.backup, name));
      for (const name of [...entries.directories].sort(
        (a, b) => b.split("/").length - a.split("/").length,
      ))
        await this.operations.rmdir(path.join(this.backup, name));
      if (entries.files.includes(marker))
        await this.operations.unlink(path.join(this.backup, marker));
      await this.operations.rmdir(this.backup);
    } catch (error) {
      throw exportError(
        `Export installed, but backup cleanup failed at ${this.backup}. ${errorMessage(error)}`,
        error,
      );
    }
  }
}
