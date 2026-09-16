/** Optional changed-route detection powering the Browse changed/all filter. */
import type { ManifestV5 } from "@mokly/viewer/data";

import { compileCatalogue } from "../build/compile.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import {
  removedManifestEntries,
  type CatalogueChangeSnapshot,
} from "../registry/changes.js";
import { readManifest } from "../registry/manifest.js";
import type { ReadOnlyReviewRepository } from "../review/repository.js";

import {
  readCatalogueChanges,
  type ComponentChangeSnapshot,
} from "./component_changes.js";

/** Impact and ownership evidence resolved together from one baseline. */
export interface ResolvedCatalogueChanges extends CatalogueChangeSnapshot {
  componentChanges?: ComponentChangeSnapshot;
}

/** Compute routes affected since the base branch point, if available. */
export async function computeChangedRoutes(
  config: ResolvedConfig,
  base: string,
  git: ReadOnlyReviewRepository,
): Promise<readonly string[] | undefined> {
  try {
    return (await computeCatalogueChanges(config, base, git)).changedRoutes;
  } catch (error) {
    if (error instanceof MoklyError && error.code === "config-invalid")
      throw error;
    return undefined;
  }
}

/** Resolve one generation; explicit review callers retain failures instead of empty changes. */
export async function computeCatalogueChanges(
  config: ResolvedConfig,
  base: string,
  git: ReadOnlyReviewRepository,
  manifest?: ManifestV5,
): Promise<ResolvedCatalogueChanges> {
  const compilation =
    config.generatedOutput === "derived" && !manifest
      ? await compileCatalogue(config)
      : undefined;
  manifest ??= compilation?.manifest ?? readManifest(config);
  const commit = await git.evidence.mergeBase(base, "HEAD");
  const componentChanges = await readCatalogueChanges(
    config,
    manifest,
    base,
    git,
    commit,
    compilation?.outputs,
  );
  const { baseline, changedRoutes } = componentChanges;
  const removedEntries = removedManifestEntries(manifest, baseline);
  return {
    schemaVersion: 1,
    componentChanges,
    baseRef: base,
    baseCommit: commit,
    removedEntries,
    changedRoutes: [
      ...new Set([
        ...(changedRoutes ?? []),
        ...removedEntries.map(({ entry }) => entry.route),
      ]),
    ].sort(),
  };
}
