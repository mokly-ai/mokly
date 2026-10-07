import type fs from "node:fs";

import { exportError } from "./error.js";
import type { ExportOperations } from "./operations.js";
import {
  assertExportOwnership,
  assertRealExportDirectory,
} from "./ownership.js";

/** Identity of the directory inspected before any export generation. */
export interface ExportDirectoryIdentity {
  kind: "directory";
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}

/** Initial absence never grants permission to replace a later directory. */
export type ExportDestination = { kind: "absent" } | ExportDirectoryIdentity;

/** Capture identity on both sides of ownership validation. */
export async function captureDestination(
  output: string,
  operations: ExportOperations,
): Promise<ExportDestination> {
  const stat = await operations.lstat(output);
  const initial: ExportDestination = stat
    ? directoryIdentity(output, stat)
    : { kind: "absent" };
  await assertExportOwnership(output);
  await assertDestination(output, initial, operations);
  return initial;
}

/** Reject source replacement, disappearance, or creation since inspection. */
export async function assertDestination(
  candidate: string,
  initial: ExportDestination,
  operations: ExportOperations,
): Promise<void> {
  const stat = await operations.lstat(candidate);
  if (
    initial.kind === "absent"
      ? stat === undefined
      : stat?.isDirectory() &&
        !stat.isSymbolicLink() &&
        stat.dev === initial.dev &&
        stat.ino === initial.ino &&
        stat.birthtimeNs === initial.birthtimeNs
  )
    return;
  throw exportError(
    `Export destination changed since inspection: ${candidate}. Inspect the destination before retrying.`,
  );
}

function directoryIdentity(
  output: string,
  stat: fs.BigIntStats,
): ExportDirectoryIdentity {
  assertRealExportDirectory(output, stat);
  return {
    kind: "directory",
    dev: stat.dev,
    ino: stat.ino,
    birthtimeNs: stat.birthtimeNs,
  };
}
