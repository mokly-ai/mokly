/** Resolved route targets shared by the served shell view modules. */

import type { ManifestComponent } from "../components/manifest_types.js";
import type {
  ManifestEntry,
  ManifestPage,
  ManifestScreen,
  ManifestUseCase,
} from "../registry/types.js";

/** A routed structured entry in the public catalogue. */
export type RoutedEntry =
  ManifestScreen | ManifestPage | ManifestUseCase | ManifestComponent;

/** One resolved viewable destination: a screen, use case, or complete page. */
export type RouteTarget = { kind: "entry"; entry: RoutedEntry };

/** Classify a catalogue lookup result into a renderable route target. */
export function toRouteTarget(value: ManifestEntry): RouteTarget | undefined {
  return { kind: "entry", entry: value };
}
