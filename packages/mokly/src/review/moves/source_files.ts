import fs from "node:fs/promises";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isInside, projectRealPath, toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import type { BaselineReader } from "../git.js";

export async function historicalSourceBytes(
  source: string,
  inventory: readonly string[],
  reader: BaselineReader,
  commit: string,
): Promise<Uint8Array | undefined> {
  if (!isSafeRepositoryPath(source) || !inventory.includes(source)) return;
  let resolved = source;
  for (let depth = 0; depth < 40; depth++) {
    if (!isSafeRepositoryPath(resolved)) return;
    const kind = await reader.fileKind(commit, resolved);
    if (kind === "regular")
      return inventory.includes(resolved)
        ? reader.readFileBytes(commit, resolved)
        : undefined;
    if (kind !== "missing") return;
    const parts = resolved.split("/");
    let redirected = false;
    for (let length = 1; length < parts.length; length++) {
      const prefix = parts.slice(0, length).join("/");
      if ((await reader.fileKind(commit, prefix)) !== "symlink") continue;
      const target = await reader.readFile(commit, prefix);
      if (!target || target.startsWith("/") || target.includes("\\")) return;
      resolved = path.posix.normalize(
        path.posix.join(
          path.posix.dirname(prefix),
          target,
          ...parts.slice(length),
        ),
      );
      redirected = true;
      break;
    }
    if (!redirected) return;
  }
}

export async function currentSourceBytes(
  source: string,
  inventory: readonly string[],
  config: ResolvedConfig,
): Promise<Uint8Array | undefined> {
  if (!isSafeRepositoryPath(source) || !inventory.includes(source)) return;
  try {
    const candidate = path.resolve(config.repoRoot, source);
    if (!(await fs.lstat(candidate)).isFile()) return;
    const real = projectRealPath(candidate),
      root = projectRealPath(config.repoRoot);
    if (
      !isInside(root, real) ||
      !inventory.includes(toPosixPath(path.relative(root, real)))
    )
      return;
    return await fs.readFile(real);
  } catch (error) {
    if (
      ["ENOENT", "ENOTDIR"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      return;
    throw error;
  }
}
