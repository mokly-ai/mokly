/** Initial validated catalogue selection for one HTTP server process. */

import type { ResolvedConfig } from "../config/types.js";

import {
  loadLiveCatalogueSnapshot,
  loadServedCatalogueSnapshot,
  type CatalogueSnapshot,
} from "./catalogue_snapshot.js";
import type { ServerOptions } from "./http_types.js";

/** Reuse supplied state or load the one startup snapshot implied by Serve options. */
export async function loadInitialCatalogueSnapshot(
  config: ResolvedConfig,
  options: ServerOptions,
): Promise<CatalogueSnapshot> {
  if (options.snapshot) return options.snapshot;
  if (options.manifest?.schemaVersion === "live-index-1")
    return loadLiveCatalogueSnapshot(config, options.manifest);
  const base =
    options.manifest ||
    options.componentChanges ||
    options.componentChangeSource
      ? undefined
      : options.review
        ? options.base
        : undefined;
  return loadServedCatalogueSnapshot(
    config,
    base,
    options.manifest,
    options.review?.repository,
  );
}
