/** Initial validated catalogue selection for one HTTP server process. */

import type { ResolvedConfig } from "../config/types.js";
import { includeMovedEntries } from "../review/moves/entries.js";

import {
  catalogueSnapshotForConfig,
  loadLiveCatalogueSnapshot,
  loadServedCatalogueSnapshot,
  type CatalogueSnapshot,
} from "./catalogue_snapshot.js";
import { ComponentChangeCache } from "./component_change_cache.js";
import type { ComponentChangeSnapshot } from "./component_changes.js";
import type { ServerOptions } from "./http_types.js";
import { validateServeOrigins } from "./origin_options.js";

/** Reuse supplied state or load the one startup snapshot implied by Serve options. */
export async function loadInitialCatalogueSnapshot(
  config: ResolvedConfig,
  options: ServerOptions,
): Promise<CatalogueSnapshot> {
  validateServeOrigins(options);
  if (options.snapshot)
    return catalogueSnapshotForConfig(options.snapshot, config);
  if (options.manifest?.schemaVersion === "live-index-1")
    return catalogueSnapshotForConfig(
      await loadLiveCatalogueSnapshot(config, options.manifest),
      config,
    );
  const base =
    options.manifest ||
    options.componentChanges ||
    options.componentChangeSource
      ? undefined
      : options.review
        ? options.base
        : undefined;
  return catalogueSnapshotForConfig(
    await loadServedCatalogueSnapshot(
      config,
      base,
      options.manifest,
      options.review?.repository,
    ),
    config,
  );
}

/** Resolve initial change membership, including accepted moves, before serving. */
export async function loadInitialChanges(
  snapshot: CatalogueSnapshot,
  options: ServerOptions,
): Promise<{
  componentChanges: ComponentChangeSnapshot | undefined;
  changedEntries: readonly string[] | undefined;
}> {
  const componentChanges =
    options.componentChanges ??
    snapshot.componentChanges ??
    (options.review && options.componentChangeSource
      ? await new ComponentChangeCache(options.componentChangeSource).read(
          options.updateVersion ?? 1,
        )
      : undefined);
  const changedEntries = includeMovedEntries(
    snapshot.changes?.changedEntries ??
      options.changedEntries ??
      componentChanges?.changedEntries,
    componentChanges?.pairing?.moves,
  );
  return { componentChanges, changedEntries };
}
