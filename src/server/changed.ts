/** Optional changed-route detection powering the Browse changed/all filter. */
import type { ManifestV8 } from "@mokly/viewer/data";

import { compileCatalogue } from "../build/compile.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";
import {
  removedManifestEntries,
  type CatalogueChangeSnapshot,
} from "../registry/changes.js";
import { readManifest } from "../registry/manifest.js";
import {
  acceptedGenerationFromCompilation,
  type AcceptedGeneration,
} from "../review/accepted_generation.js";
import type { ChangeEvidence } from "../review/change_evidence.js";
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
export async function computeChangedPaths(
  config: ResolvedConfig,
  base: string,
  git: ReadOnlyReviewRepository,
): Promise<readonly string[] | undefined> {
  try {
    return (await computeCatalogueChanges(config, base, git)).changedEntries;
  } catch (error) {
    if (error instanceof MoklyError && error.code === "config-invalid")
      throw error;
    return undefined;
  }
}

/** Resolve one generation without aggregating a changed variant into its parent route. */
export async function computeCatalogueChanges(
  config: ResolvedConfig,
  base: string,
  git: ReadOnlyReviewRepository,
  manifest?: ManifestV8,
  acceptedEvidence?: ChangeEvidence,
  accepted?: AcceptedGeneration,
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
    accepted ??
      (compilation
        ? acceptedGenerationFromCompilation(compilation)
        : undefined),
    acceptedEvidence,
  );
  const { baseline, changedEntries } = componentChanges;
  const moves = componentChanges.pairing?.moves ?? [];
  const removedEntries = removedManifestEntries(manifest, baseline, moves);
  return {
    schemaVersion: 2,
    movedEntries: moves.map(({ path, previousPath }) => ({
      path,
      previousPath,
    })),
    componentChanges,
    baseRef: base,
    baseCommit: commit,
    removedEntries,
    changedEntries: [
      ...new Set([
        ...(changedEntries ?? []),
        ...moves.map((move) => move.path),
        ...removedEntries.map(({ entry }) => entry.path),
      ]),
    ].sort(),
  };
}
