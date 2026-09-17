import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { compileCatalogue, type Compilation } from "../build/compile.js";
import { loadConfig } from "../config/load.js";
import { publicPathLocation } from "../config/public_files.js";
import type { ResolvedConfig } from "../config/types.js";
import type { OptionalReviewAssetReader } from "../review/assets.js";
import { reviewChangedPaths } from "../review/changed_paths.js";
import type { RepositoryEvidence } from "../review/git.js";
import type { PreparedReviewRepository } from "../review/prepare.js";

import { exportError } from "./error.js";
import { capturePublicFiles } from "./public_files.js";

/** Share captured public bytes between comparison and Changes calculations. */
export function capturedAssetReader(
  files: ReadonlyMap<string, Buffer>,
  config: ResolvedConfig,
): OptionalReviewAssetReader {
  return {
    read: async (name) => {
      const bytes = files.get(name);
      if (!bytes)
        throw exportError(`Comparison resource is not exportable: ${name}`);
      return bytes;
    },
    readIfExists: async (name) => files.get(name),
    readLocated: async (name) => {
      const location = isSafeRepositoryPath(name)
        ? publicPathLocation(path.resolve(config.mockupsDir, name), config)
        : undefined;
      if (!location)
        throw exportError(`Comparison resource is not exportable: ${name}`);
      const content = files.get(name);
      return { location, ...(content ? { content } : {}) };
    },
  };
}

/** Pin branch identity and changed-path evidence for every comparison consumer. */
export function pinnedEvidence(
  commit: string,
  changed: readonly string[],
): RepositoryEvidence {
  return {
    mergeBase: async () => commit,
    changedPaths: async () => changed,
  };
}

/** Recheck effective source/config, public bytes, and evidence before installation. */
export async function assertInputsUnchanged(
  config: ResolvedConfig,
  compilation: Compilation,
  publicFiles: ReadonlyMap<string, Buffer>,
  prepared: PreparedReviewRepository | undefined,
  changed: readonly string[],
  exclusions: readonly string[],
): Promise<void> {
  const freshConfig = await loadConfig(config.repoRoot, config.configPath);
  const fresh = await compileCatalogue(freshConfig);
  freshConfig.sourceFiles = fresh.manifest.sourceFiles;
  const publicNow = await capturePublicFiles(
    freshConfig,
    freshConfig.generatedOutput === "derived" ? fresh.outputs : undefined,
  );
  const changedNow = prepared
    ? await reviewChangedPaths(
        prepared.evidence,
        prepared.commit,
        config,
        config.review.outDir,
        exclusions,
      )
    : [];
  if (
    !isDeepStrictEqual(config, freshConfig) ||
    !isDeepStrictEqual(compilation, fresh) ||
    !isDeepStrictEqual(publicFiles, publicNow) ||
    !isDeepStrictEqual(changed, changedNow)
  )
    throw exportError(
      "Export inputs changed during generation; retry the export.",
    );
  await prepared?.assertUnchanged();
}
