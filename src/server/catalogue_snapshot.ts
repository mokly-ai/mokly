import type { ManifestV8 } from "@mokly/viewer/data";
import { createCatalogue, type Catalogue } from "@mokly/viewer/server";

import { compileCatalogue } from "../build/compile.js";
import {
  compilationForManifest,
  componentRuntime,
} from "../build/component_runtime.js";
import type { GeneratedFile } from "../build/generated_file.js";
import { assertFreshSourceInventory } from "../build/source_freshness.js";
import type { ResolvedConfig } from "../config/types.js";
import { timeAsync, timeSync } from "../diagnostics/timings.js";
import { MoklyError } from "../errors.js";
import {
  parseCatalogueIndex,
  type CatalogueIndex,
} from "../registry/catalogue_index.js";
import type { CatalogueChangeSnapshot } from "../registry/changes.js";
import { parseManifest } from "../registry/manifest.js";
import {
  acceptedGenerationFromInventory,
  acceptedGenerationFromCompilation,
  type AcceptedGeneration,
} from "../review/accepted_generation.js";
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
  readonly outputs?: ReadonlyMap<string, GeneratedFile>;
  readonly changes?: CatalogueChangeSnapshot;
  readonly componentChanges?: ComponentChangeSnapshot;
}

/** Read current metadata once; resolve impact from exactly that validated manifest. */
export async function loadCatalogueSnapshot(
  config: ResolvedConfig,
  resolveChanges?: (
    manifest: ManifestV8,
    accepted: AcceptedGeneration,
  ) => Promise<ResolvedCatalogueChanges | undefined>,
  manifest?: ManifestV8,
): Promise<CatalogueSnapshot> {
  const supplied = manifest !== undefined;
  const compilation = manifest
    ? compilationForManifest(manifest, config)
    : await compileCatalogue(config);
  manifest ??= compilation!.manifest;
  const acceptedManifest = manifest;
  timeSync("catalogue.validate", () => parseManifest(acceptedManifest));
  const inventory = supplied
    ? await timeAsync("catalogue.source-freshness", () =>
        assertFreshSourceInventory(config, acceptedManifest),
      )
    : undefined;
  if (!supplied && compilation) {
    config.sourceFiles = acceptedManifest.sourceFiles;
    config.postcssWatchDirectories =
      componentRuntime(compilation).config.postcssWatchDirectories ?? [];
  }
  const changes = resolveChanges
    ? await timeAsync("changes.classify", () =>
        resolveChanges(
          acceptedManifest,
          compilation
            ? acceptedGenerationFromCompilation(compilation)
            : acceptedGenerationFromInventory(inventory!),
        ),
      )
    : undefined;
  return {
    [configIdentity]: config,
    ...(compilation ? { outputs: compilation.outputs } : {}),
    catalogue: timeSync("catalogue.index", () =>
      createCatalogue(acceptedManifest, changes?.removedEntries),
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
  manifest?: ManifestV8,
  repository?: () => ReadOnlyReviewRepository,
): Promise<CatalogueSnapshot> {
  return loadCatalogueSnapshot(
    config,
    base === undefined || !repository
      ? undefined
      : async (current, accepted) => {
          try {
            return await computeCatalogueChanges(
              config,
              base,
              repository(),
              current,
              undefined,
              accepted,
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
