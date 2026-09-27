/** Resolved route targets shared by the served shell view modules. */

import type { CatalogueManifestEntry } from "./catalogue.js";

/** One resolved viewable destination: a screen, use case, or complete page. */
export type RouteTarget = { kind: "entry"; entry: CatalogueManifestEntry };

/** Classify a catalogue lookup result into a renderable route target. */
export function toRouteTarget(value: CatalogueManifestEntry): RouteTarget {
  return { kind: "entry", entry: value };
}
