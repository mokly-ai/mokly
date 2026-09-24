/** Resolved route targets shared by the served shell view modules. */

import type { ManifestEntry } from "../registry/types.js";

/** One resolved viewable destination: a screen, use case, or complete page. */
export type RouteTarget = { kind: "entry"; entry: ManifestEntry };

/** Classify a catalogue lookup result into a renderable route target. */
export function toRouteTarget(value: ManifestEntry): RouteTarget {
  return { kind: "entry", entry: value };
}
