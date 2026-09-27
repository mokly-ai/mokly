import type { ColorScheme, Viewport } from "@mokly/viewer";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import {
  artifactRouteForEntry,
  portableArtifactHref,
} from "../build/logical_routes.js";

import type { InteractiveRouteTable } from "./types.js";

export interface InteractiveRouteTableInput {
  catalogueSchemes: readonly ColorScheme[];
  colorScheme: ColorScheme;
  entries: readonly ResolvedRegistryEntry[];
  sourceRoute: string;
  viewport: Viewport;
}

/** Resolve Live destinations through the ordinary Build artifact resolver. */
export function buildInteractiveRouteTable(
  input: InteractiveRouteTableInput,
): InteractiveRouteTable {
  const byId = new Map(input.entries.map((entry) => [entry.id, entry]));
  const routed = input.entries
    .filter((entry) => entry.kind !== "collection")
    .sort((left, right) => left.id.localeCompare(right.id));
  const routes: Record<string, InteractiveRouteTable[string]> = {};
  for (const entry of routed) {
    const artifact = artifactRouteForEntry(
      entry,
      input.viewport,
      input.colorScheme,
      byId,
      input.catalogueSchemes,
    );
    if (!artifact) continue;
    routes[entry.id] = {
      href: portableArtifactHref(input.sourceRoute, artifact),
    };
  }
  return routes;
}
