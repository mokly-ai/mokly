import fs from "node:fs";
import path from "node:path";

import { GENERATED_DIRECTORY } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

/** Refuse symlinks and special files before output writes or tracked checks. */
export function assertSafeGeneratedTree(config: ResolvedConfig): void {
  const root = path.join(config.mockupsDir, GENERATED_DIRECTORY);
  const unsafe: { candidate: string; error: MoklyError }[] = [];
  walk(root);
  const [first] = unsafe.sort((left, right) =>
    left.candidate < right.candidate
      ? -1
      : left.candidate > right.candidate
        ? 1
        : 0,
  );
  if (first) throw first.error;

  function walk(candidate: string): void {
    let stats: fs.Stats | undefined;
    try {
      stats = checkedEntry(candidate, config, candidate === root);
    } catch (error) {
      if (!(error instanceof MoklyError)) throw error;
      unsafe.push({ candidate, error });
      return;
    }
    if (stats?.isDirectory()) {
      let names: string[];
      try {
        names = fs.readdirSync(candidate);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      for (const name of names.sort()) walk(path.join(candidate, name));
    }
  }
}

function checkedEntry(
  candidate: string,
  config: ResolvedConfig,
  root: boolean,
): fs.Stats | undefined {
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (
    stats.isSymbolicLink() ||
    (!stats.isDirectory() && (root || !stats.isFile()))
  ) {
    const file = toPosixPath(path.relative(config.repoRoot, candidate));
    throw new MoklyError(
      "build-invalid",
      `${GENERATED_DIRECTORY}/ contains a symlink or non-regular entry: ${file}; delete it before building or checking`,
    );
  }
  return stats;
}
