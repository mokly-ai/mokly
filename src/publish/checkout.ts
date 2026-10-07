import path from "node:path";

import { MOKLY_CACHE } from "../config/cache_paths.js";
import { isInside, projectRealPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { isCancellation, MoklyError } from "../errors.js";
import {
  isReservationDirectory,
  RESERVATION_DIRECTORY,
} from "../export/reservation.js";
import type { GitCommandRunner } from "../review/git.js";

import { checkoutFailure } from "./checkout_errors.js";

/** Paths pinned before export so status exclusions cannot follow later edits. */
export interface PublishCheckoutPaths {
  readonly gitRoot: string;
  readonly generated: readonly string[];
  readonly output: readonly string[];
}

/** Keep lexical and physical aliases of this run's output and generated root. */
export function publishCheckoutPaths(
  config: ResolvedConfig,
  gitRoot: string,
  out: string,
): PublishCheckoutPaths {
  const output = path.resolve(path.dirname(config.configPath), out);
  return {
    gitRoot,
    generated: [
      ...new Set([config.generatedDir, projectRealPath(config.generatedDir)]),
    ],
    output: [...new Set([output, projectRealPath(output)])],
  };
}

/** Reject every Git status entry except this output and Mokly-owned local state. */
export async function assertCleanCheckout(
  runner: GitCommandRunner,
  paths: PublishCheckoutPaths,
  duringExport = false,
  ignoreRules: readonly string[] = [],
): Promise<void> {
  let status: string;
  try {
    status = await runner.run([
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=none",
      "--renames",
    ]);
  } catch (error) {
    if (isCancellation(error)) throw error;
    throw new MoklyError(
      "git-failed",
      "Could not read the publication checkout status.",
    );
  }
  const owned = new Map<string, boolean>();
  const changed = statusPaths(status)
    .filter(({ name, untracked }) => {
      const candidate = path.resolve(paths.gitRoot, name);
      if (paths.generated.some((root) => isInside(root, candidate)))
        return true;
      if (paths.output.some((root) => isInside(root, candidate))) return false;
      const segments = name.split("/");
      for (const [index, segment] of segments.entries()) {
        if (
          segment === MOKLY_CACHE ||
          (index < segments.length - 1 &&
            (/^\.mokly-(?:review-(?:served-)?|write-.+-)[a-zA-Z0-9]{6}$/.test(
              segment,
            ) ||
              (untracked &&
                index === segments.length - 2 &&
                isTemporaryModule(segment, segments[index + 1]!))))
        )
          return false;
        if (segment === RESERVATION_DIRECTORY) {
          const directory = path.resolve(
            paths.gitRoot,
            ...segments.slice(0, index + 1),
          );
          if (!owned.has(directory))
            owned.set(directory, isReservationDirectory(directory));
          if (owned.get(directory)) return false;
        }
      }
      return true;
    })
    .map(({ name }) => name);
  if (changed.length || ignoreRules.length)
    throw checkoutFailure(
      "git-uncommitted",
      changed,
      duringExport,
      ignoreRules,
    );
}

/** Porcelain v1 -z records put the rename destination before its source. */
function statusPaths(
  status: string,
): Array<{ name: string; untracked: boolean }> {
  const records = status.split("\0");
  const paths: Array<{ name: string; untracked: boolean }> = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index]!;
    if (!record) continue;
    paths.push({ name: record.slice(3), untracked: record.startsWith("?? ") });
    if (record.slice(0, 2).includes("R") || record.slice(0, 2).includes("C")) {
      const source = records[++index];
      if (source) paths.push({ name: source, untracked: false });
    }
  }
  return paths;
}

/** Config and PostCSS loaders write only one module in each private temp root. */
function isTemporaryModule(directory: string, name: string): boolean {
  const kind = /^mokly-(config|postcss)-[a-zA-Z0-9]{6}$/.exec(directory)?.[1];
  return kind !== undefined && name === `${kind}.mjs`;
}
