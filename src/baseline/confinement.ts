import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isInside } from "../config/paths.js";

import { BaselineError, assertBaselineActive } from "./errors.js";
import type { BaselineFileSystem, BaselineStat } from "./types.js";

/** Create each missing directory only after checking all existing ancestors. */
export async function ensureBaselineDirectory(
  fs: BaselineFileSystem,
  root: string,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!isInside(root, directory) || (await fs.stat(root))?.kind !== "directory")
    throw new Error(`Unsafe baseline directory: ${directory}`);
  let current = root;
  for (const part of path
    .relative(root, directory)
    .split(path.sep)
    .filter(Boolean)) {
    assertBaselineActive(signal);
    current = path.join(current, part);
    const stat = await fs.stat(current);
    if (stat && stat.kind !== "directory")
      throw new Error(`Not a regular baseline directory: ${current}`);
    if (!stat) await fs.mkdir(current);
  }
}

/** Inspect every ancestor, retaining missing/non-regular classifications for readers. */
export async function confinedBaselineStat(
  fs: BaselineFileSystem,
  root: string,
  relative: string,
  signal?: AbortSignal,
): Promise<BaselineStat | undefined> {
  if (!isSafeRepositoryPath(relative))
    throw new BaselineError(
      "baseline-output-invalid",
      `Unsafe baseline path: ${relative}`,
    );
  const parts = relative.split("/");
  let current = root;
  for (let index = 0; index <= parts.length; index++) {
    assertBaselineActive(signal);
    const stat = await fs.stat(current);
    if (!stat || index === parts.length) return stat;
    if (stat.kind !== "directory")
      return { ...stat, kind: stat.kind === "symlink" ? "symlink" : "other" };
    current = path.join(current, parts[index]!);
  }
  return;
}

/** Adoption rejects symlinks and device-like entries anywhere in the output tree. */
export async function validateOutputTree(
  fs: BaselineFileSystem,
  directory: string,
  signal?: AbortSignal,
): Promise<void> {
  if ((await fs.stat(directory))?.kind !== "directory")
    throw new Error(`Missing baseline output directory: ${directory}`);
  const pending = [directory];
  while (pending.length) {
    assertBaselineActive(signal);
    const parent = pending.pop()!;
    for (const name of await fs.list(parent)) {
      if (!isSafeRepositoryPath(name) || name.includes("/"))
        throw new Error(`Unsafe baseline entry: ${name}`);
      const child = path.join(parent, name);
      const stat = await fs.stat(child);
      if (stat?.kind === "directory") pending.push(child);
      else if (stat?.kind !== "regular")
        throw new Error(`Not a regular baseline output: ${child}`);
    }
  }
}
