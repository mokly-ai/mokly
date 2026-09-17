import type { ManifestV5 } from "@mokly/viewer/data";
import { createCatalogue, type Catalogue } from "@mokly/viewer/server";

import { assertFreshSourceInventory } from "../build/source_freshness.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import {
  parseCatalogueIndex,
  type CatalogueIndex,
} from "../registry/catalogue_index.js";
import type { CatalogueChangeSnapshot } from "../registry/changes.js";
import { parseManifest, readManifest } from "../registry/manifest.js";
import type { ReadOnlyReviewRepository } from "../review/repository.js";

import {
  computeCatalogueChanges,
  type ResolvedCatalogueChanges,
} from "./changed.js";
import type { ComponentChangeSnapshot } from "./component_changes.js";

const configIdentity = Symbol("validated catalogue config");

/** Validated current catalogue and optional impact for the same generation. */
export interface CatalogueSnapshot {
  readonly [configIdentity]: ResolvedConfig;
  readonly catalogue: Catalogue;
  readonly changes?: CatalogueChangeSnapshot;
  readonly componentChanges?: ComponentChangeSnapshot;
}

/** Read current metadata once; resolve impact from exactly that validated manifest. */
export async function loadCatalogueSnapshot(
  config: ResolvedConfig,
  resolveChanges?: (
    manifest: ManifestV5,
  ) => Promise<ResolvedCatalogueChanges | undefined>,
  manifest: ManifestV5 = readManifest(config),
): Promise<CatalogueSnapshot> {
  timeSync("catalogue.validate", () => parseManifest(manifest));
  await timeAsync("catalogue.source-freshness", () =>
    assertFreshSourceInventory(config, manifest),
  );
  const changes = resolveChanges
    ? await timeAsync("changes.classify", () => resolveChanges(manifest))
    : undefined;
  return {
    [configIdentity]: config,
    catalogue: timeSync("catalogue.index", () =>
      createCatalogue(manifest, changes?.removedEntries),
    ),
    ...(changes ? { changes } : {}),
    ...(changes?.componentChanges
      ? { componentChanges: changes.componentChanges }
      : {}),
  };
}

/** Validate the distinct live index without claiming uncomputed render evidence. */
export async function loadLiveCatalogueSnapshot(
  config: ResolvedConfig,
  index: CatalogueIndex,
): Promise<CatalogueSnapshot> {
  parseCatalogueIndex(index);
  await assertFreshSourceInventory(config, index);
  return { [configIdentity]: config, catalogue: createCatalogue(index) };
}

/** Validate startup metadata once, retaining Browse when optional history is unavailable. */
export function loadServedCatalogueSnapshot(
  config: ResolvedConfig,
  base?: string,
  manifest?: ManifestV5,
  repository?: () => ReadOnlyReviewRepository,
): Promise<CatalogueSnapshot> {
  return loadCatalogueSnapshot(
    config,
    base === undefined || !repository
      ? undefined
      : async (current) => {
          try {
            return await computeCatalogueChanges(
              config,
              base,
              repository(),
              current,
            );
          } catch (error) {
            if (
              error instanceof MoklyError &&
              error.code === "manifest-invalid"
            )
              throw error;
            return undefined;
          }
        },
    manifest,
  );
}

/** Reject snapshots from another configuration or outside the validation factory. */
export function catalogueSnapshotForConfig(
  snapshot: CatalogueSnapshot,
  config: ResolvedConfig,
): CatalogueSnapshot {
  if (snapshot[configIdentity] !== config)
    throw new MoklyError(
      "manifest-invalid",
      "catalogue snapshot does not belong to this configuration",
    );
  return snapshot;
}
