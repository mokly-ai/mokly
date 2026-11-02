/** Resolved route targets shared by the served shell view modules. */

import type { ShellCatalogueRoutedEntry } from "../catalogue/scoped_types.js";

/** One resolved viewable destination: a screen, use case, or complete page. */
export type RouteTarget = { kind: "entry"; entry: ShellCatalogueRoutedEntry };

/** Classify a catalogue lookup result into a renderable route target. */
export function toRouteTarget(value: ShellCatalogueRoutedEntry): RouteTarget {
  return { kind: "entry", entry: value };
}
