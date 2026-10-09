import type { ComponentViewRecord } from "@mokly/viewer";
import { viewRoute } from "@mokly/viewer/data";

import type { CatalogueMetadata } from "../registry/catalogue_index.js";

/** Keep the referring route on every explicit renderer resource. */
export function componentResourceSeeds(
  views: ReadonlyMap<string, ComponentViewRecord>,
): ResourceSeed[] {
  return [...views].flatMap(([sourceRoute, view]) =>
    view.resources.map(({ path }) => ({ path, sourceRoute })),
  );
}

export function manifestResourceSeeds(
  manifest: CatalogueMetadata,
): ResourceSeed[] {
  return manifest.entries.flatMap((entry) =>
    "componentViews" in entry
      ? (entry.componentViews ?? []).flatMap((view) =>
          view.resources.map(({ path }) => ({
            path,
            sourceRoute: viewRoute(entry.path, view.viewport, view.colorScheme),
          })),
        )
      : [],
  );
}

/** An explicit closure seed retains its referring document for diagnostics. */
export interface ResourceSeed {
  path: string;
  sourceRoute: string;
}

/** Bind bare seeds to the first document while keeping explicit origins. */
export function resourceSeedOrigins(
  seeds: readonly (string | ResourceSeed)[],
  firstDocument: string | undefined,
): Map<string, string> {
  return new Map(
    seeds.map((seed) =>
      typeof seed === "string"
        ? [seed, firstDocument ?? seed]
        : [seed.path, seed.sourceRoute],
    ),
  );
}
