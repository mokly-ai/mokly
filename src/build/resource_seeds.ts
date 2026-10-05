import type { ComponentViewRecord } from "@mokly/viewer";
import { viewRoute } from "@mokly/viewer/data";

import type { CatalogueMetadata } from "../registry/catalogue_index.js";

import type { ResourceSeed } from "./html_links.js";

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
            sourceRoute: viewRoute(
              entry.kind,
              entry.id,
              view.viewport,
              view.colorScheme,
            ),
          })),
        )
      : [],
  );
}
