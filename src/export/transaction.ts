import fs from "node:fs";
import path from "node:path";

import { projectRealPath } from "../config/paths.js";
import { errorMessage, isCancellation } from "../errors.js";

import { ExportBackup } from "./backup.js";
import { failAfterExportCleanup } from "./cleanup.js";
import {
  assertDestination,
  captureDestination,
  type ExportDestination,
} from "./destination.js";
import { assertExportActive, exportError } from "./error.js";
import { fileExportOperations, type ExportOperations } from "./operations.js";
import {
  assertExportOwnership,
  type LegacyExportOwnership,
} from "./ownership.js";
import { prepareReservation, reservationPath } from "./reservation.js";

/** Marker proving ownership of an active export reservation. */
export const TRANSACTION_MARKER = ".mokly-export-transaction";

/** Deterministic reservation shared by aliases of the same output. */
export function exportReservation(output: string): string {
  return reservationPath(output);
}

/** One owned stage and rollback directory protected by an exclusive writer. */
export class ExportTransaction {
  readonly stage: string;
  readonly backup: string;
  readonly reservationRoot: string;
  private installed = false;

  private constructor(
    readonly output: string,
    readonly reservation: string,
    private readonly operations: ExportOperations,
    private readonly legacy: LegacyExportOwnership | undefined,
    private readonly initial: ExportDestination,
  ) {
    this.stage = path.join(reservation, "stage");
    this.backup = path.join(reservation, "backup");
    this.reservationRoot = path.dirname(path.dirname(reservation));
  }

  /** Reserve output without stealing an abandoned or active reservation. */
  static async open(
    output: string,
    legacy?: LegacyExportOwnership,
    operations = fileExportOperations,
  ): Promise<ExportTransaction> {
    const initial = await captureDestination(output, operations, legacy);
    const real = projectRealPath(output);
    await assertDestination(real, initial, operations);
    await prepareReservation(real);
    const reservation = exportReservation(real);
    try {
      await fs.promises.mkdir(reservation);
    } catch (error) {
      throw exportError(
        `Export reservation unavailable: ${reservation}. Check for an active export before explicitly recovering an abandoned reservation.`,
        error,
      );
    }
    const transaction = new ExportTransaction(
      real,
      reservation,
      operations,
      legacy,
      initial,
    );
    try {
      await fs.promises.writeFile(
        path.join(reservation, TRANSACTION_MARKER),
        JSON.stringify({ schemaVersion: 2, output: path.basename(real) }),
      );
      await fs.promises.mkdir(transaction.stage);
      return transaction;
    } catch (error) {
      return failAfterExportCleanup(error, () => transaction.close());
    }
  }

  /** Replace validated owned output and restore its previous bytes on failure. */
  async install(signal?: AbortSignal): Promise<void> {
    await assertDestination(this.output, this.initial, this.operations);
    await assertExportOwnership(this.output, this.legacy);
    await assertDestination(this.output, this.initial, this.operations);
    assertExportActive(signal);
    const existed = this.initial.kind === "directory";
    const backup = new ExportBackup(
      this.output,
      this.backup,
      this.operations,
      this.legacy,
    );
    if (existed) await this.operations.rename(this.output, this.backup);
    try {
      if (this.initial.kind === "directory")
        await backup.validate(this.initial);
      assertExportActive(signal);
      await this.operations.rename(this.stage, this.output);
    } catch (error) {
      if (existed) return backup.restore(error);
      throw exportError(
        `Could not install export; no previous output was moved. ${errorMessage(error)}`,
        error,
        { cancelled: isCancellation(error) },
      );
    }
    this.installed = true;
    if (existed) await backup.discard();
  }

  /** Remove only this operation's temporary files, retaining a recovery backup. */
  async close(): Promise<void> {
    if (!(await this.operations.lstat(this.reservation))) return;
    if (await this.operations.lstat(this.backup))
      throw exportError(
        `${this.installed ? "Export installed, but recovery files" : "Export recovery files"} retained at ${this.reservation}; the backup was not deleted.`,
      );
    try {
      await this.operations.remove(this.stage);
      const marker = path.join(this.reservation, TRANSACTION_MARKER);
      if (await this.operations.lstat(marker))
        await this.operations.unlink(marker);
      await this.operations.rmdir(this.reservation);
    } catch (error) {
      throw exportError(
        `${this.installed ? "Export installed, but cleanup failed" : "Export cleanup failed"}; owned temporary files remain at ${this.reservation}.`,
        error,
      );
    }
  }
}
