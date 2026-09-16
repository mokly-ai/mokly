import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { isBaselineCachePath } from "../config/cache_paths.js";
import { isInside, projectRealPath, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";

import type { RepositoryEvidence } from "./git.js";

/** Collect deterministic changes while excluding active and retained output. */
export async function reviewChangedPaths(
  git: RepositoryEvidence,
  commit: string,
  config: ResolvedConfig,
  outDir: string,
  additionalOutputDirectories: readonly string[] = [],
): Promise<readonly string[]> {
  return timeAsync("review.changed-paths", async () => {
    const excludedPaths = [
      ...new Set(
        [outDir, ...additionalOutputDirectories].flatMap((directory) =>
          outputPaths(config.repoRoot, directory),
        ),
      ),
    ].sort();
    const changed = await git.changedPaths(commit, [
      ...excludedPaths,
      ".mokly-cache",
    ]);
    return [...new Set(changed)]
      .filter(
        (candidate) =>
          !isBaselineCachePath(
            path.resolve(config.repoRoot, candidate),
            config.repoRoot,
          ) &&
          !excludedPaths.some((excluded) => pathBelongsTo(candidate, excluded)),
      )
      .sort();
  });
}

function outputPaths(repoRoot: string, outDir: string): string[] {
  const realRepoRoot = fs.realpathSync(repoRoot);
  const lexicalRoot = isInside(repoRoot, outDir) ? repoRoot : realRepoRoot;
  const paths = [
    toPosixPath(path.relative(lexicalRoot, outDir)),
    toPosixPath(path.relative(realRepoRoot, projectRealPath(outDir))),
  ];
  for (const candidate of paths) {
    if (!isSafeRepositoryPath(candidate)) {
      throw new MoklyError(
        "review-invalid",
        `Review output is not repository-relative: ${candidate}`,
      );
    }
  }
  return [...new Set(paths)].sort();
}

function pathBelongsTo(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`);
}
