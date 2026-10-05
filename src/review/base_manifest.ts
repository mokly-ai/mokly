import path from "node:path";

import {
  GENERATED_DIRECTORY,
  type HistoricalManifest,
} from "@mokly/viewer/data";

import { joinCataloguePath } from "../baseline/catalogue.js";
import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import {
  MANIFEST_NAME,
  parseHistoricalManifest,
} from "../registry/manifest.js";

import type { BaselineReader } from "./git.js";

/** Read only the current generated-location manifest through the version gate. */
export async function readBaseManifest(
  git: BaselineReader,
  commit: string,
  config: ResolvedConfig,
): Promise<HistoricalManifest> {
  return timeAsync("review.base-manifest", async () => {
    const root =
      git.catalogue?.catalogueRoot ??
      (toPosixPath(path.relative(config.repoRoot, config.mockupsDir)) || ".");
    const candidate = joinCataloguePath(
      root,
      `${GENERATED_DIRECTORY}/${MANIFEST_NAME}`,
    );
    const kind = await git.fileKind(commit, candidate);
    if (kind === "missing")
      throw new MoklyError(
        "manifest-invalid",
        "Historical manifest is missing",
      );
    if (kind !== "regular")
      throw new MoklyError(
        "manifest-invalid",
        `Historical manifest is not a regular file: ${candidate}`,
      );
    return parseHistoricalManifest(
      JSON.parse(await git.readFile(commit, candidate)),
    );
  });
}

/** Apply the baseline's source policy without executing historical consumer code. */
export function baselineResourceConfig(
  config: ResolvedConfig,
  manifest: HistoricalManifest,
): ResolvedConfig {
  return {
    ...config,
    roots: [],
    entryModules: [],
    resolvedFiles: [],
    protectedFiles: [],
    sourceFiles: manifest.sourceFiles,
  };
}
