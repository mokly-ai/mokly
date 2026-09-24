import fs from "node:fs";
import path from "node:path";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { GENERATED_DIRECTORY } from "./styles/routes.js";

/** Refuse symlinks and special files before ownership walks or output writes. */
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
      for (const name of fs.readdirSync(candidate).sort())
        walk(path.join(candidate, name));
    }
  }
}

/** Validate just one output path's ancestors without rescanning all sibling files. */
export function assertSafeGeneratedPath(
  candidate: string,
  config: ResolvedConfig,
): void {
  const root = path.join(config.mockupsDir, GENERATED_DIRECTORY);
  let current = root;
  checkedEntry(current, config, true);
  const relative = path.relative(root, candidate);
  for (const segment of relative ? relative.split(path.sep) : []) {
    current = path.join(current, segment);
    checkedEntry(current, config, false);
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
      `mokly-generated/ contains a symlink or non-regular entry: ${file}; delete it before building or checking`,
    );
  }
  return stats;
}

/** Remove only empty package-owned directories after the entire write succeeds. */
export async function pruneEmptyGeneratedDirectories(
  config: ResolvedConfig,
): Promise<void> {
  const root = path.join(config.mockupsDir, GENERATED_DIRECTORY);
  await prune(root);

  async function prune(candidate: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(candidate, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) await prune(path.join(candidate, entry.name));
    }
    try {
      await fs.promises.rmdir(candidate);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "ENOTEMPTY" &&
        (error as NodeJS.ErrnoException).code !== "ENOENT"
      )
        throw error;
    }
  }
}
