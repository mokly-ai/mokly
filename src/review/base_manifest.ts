import path from "node:path";

import type { HistoricalManifest } from "@mokly/viewer/data";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import {
  FORMER_MANIFEST_NAME,
  MANIFEST_NAME,
  parseHistoricalManifest,
  selectManifestInput,
} from "../registry/manifest.js";

import type { BaselineReader } from "./git.js";

/** Read the canonical base manifest, falling back only when it is absent. */
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
  const canonicalPath = joinGit(prefix, MANIFEST_NAME);
  const selection = selectManifestInput(
    await git.fileExists(commit, canonicalPath),
    await git.fileExists(commit, joinGit(prefix, FORMER_MANIFEST_NAME)),
    config.compatibility.readManifestV2,
  );
  return parseHistoricalManifest(
    JSON.parse(await git.readFile(commit, joinGit(prefix, selection.filename))),
    selection.allowV2,
  );
}

/** Apply the baseline's own source policy without executing historical consumer code. */
export function baselineResourceConfig(
  config: ResolvedConfig,
  manifest: HistoricalManifest,
): ResolvedConfig {
  return {
    ...config,
    sourceFiles:
      "sourceFiles" in manifest
        ? manifest.sourceFiles
        : [
            ...manifest.entries.map((entry) => entry.sourcePath),
            ...manifest.legacyPages.map((page) => page.sourcePath),
          ],
  };
}

function joinGit(prefix: string, route: string): string {
  return prefix === "" ? route : `${prefix}/${route}`;
}
