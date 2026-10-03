import path from "node:path";

import type { HistoricalManifest } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import {
  EARLIER_MANIFEST_NAMES,
  MANIFEST_NAME,
  parseHistoricalManifest,
} from "../registry/manifest.js";

import type { BaselineReader } from "./git.js";

export async function readBaseManifest(
  git: BaselineReader,
  commit: string,
  config: ResolvedConfig,
): Promise<HistoricalManifest> {
  return timeAsync("review.base-manifest", () =>
    readMeasured(git, commit, config),
  );
}

async function readMeasured(
  git: BaselineReader,
  commit: string,
  config: ResolvedConfig,
): Promise<HistoricalManifest> {
  const prefix = toPosixPath(path.relative(config.repoRoot, config.mockupsDir));
  let canonicalPath = joinGit(prefix, MANIFEST_NAME);
  if (!(await git.fileExists(commit, canonicalPath))) {
    for (const name of EARLIER_MANIFEST_NAMES)
      if (await git.fileExists(commit, joinGit(prefix, name))) {
        canonicalPath = joinGit(prefix, name);
        break;
      }
  }
  return parseHistoricalManifest(
    JSON.parse(await git.readFile(commit, canonicalPath)),
  );
}

/** Apply the baseline's own source policy without executing historical consumer code. */
export function baselineResourceConfig(
  config: ResolvedConfig,
  manifest: HistoricalManifest,
): ResolvedConfig {
  return {
    ...config,
    sourceFiles: manifest.sourceFiles,
  };
}

function joinGit(prefix: string, route: string): string {
  return prefix === "" ? route : `${prefix}/${route}`;
}
