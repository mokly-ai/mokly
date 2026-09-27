import type { ColorScheme, Viewport } from "@mokly/viewer";
import type { ManifestEntry } from "@mokly/viewer/data";

import { portableArtifactHref } from "../build/logical_routes.js";

import type { InteractiveRouteTable } from "./types.js";

/** Retained-manifest entry accepted by Live document composition. */
export type InteractiveSourceEntry = ManifestEntry & {
  interactive?: boolean;
};

export interface InteractiveRouteTableInput {
  catalogueSchemes: readonly ColorScheme[];
  colorScheme: ColorScheme;
  entries: readonly InteractiveSourceEntry[];
  sourceRoute: string;
  viewport: Viewport;
}

/** Resolve Live destinations from the accepted generation's manifest routes. */
export function buildInteractiveRouteTable(
  input: InteractiveRouteTableInput,
): InteractiveRouteTable {
  const byId = new Map(input.entries.map((entry) => [entry.id, entry]));
  const routed = input.entries
    .filter((entry) => entry.kind !== "collection")
    .sort((left, right) => left.id.localeCompare(right.id));
  const routes: Record<string, InteractiveRouteTable[string]> = {};
  for (const entry of routed) {
    const artifact = manifestArtifactRoute(
      entry,
      input.viewport,
      input.colorScheme,
      byId,
    );
    if (!artifact) continue;
    routes[entry.id] = {
      href: portableArtifactHref(input.sourceRoute, artifact),
    };
  }
  return routes;
}

function manifestArtifactRoute(
  entry: InteractiveSourceEntry,
  viewport: Viewport,
  colorScheme: ColorScheme,
  byId: ReadonlyMap<string, InteractiveSourceEntry>,
): string | undefined {
  if (entry.kind === "page") return entry.route;
  if (entry.kind === "component") {
    const variant = entry.variants[0];
    if (!variant) return;
    return colorScheme === "dark"
      ? (variant.darkFragments?.[viewport] ?? variant.fragments[viewport])
      : variant.fragments[viewport];
  }
  const screen =
    entry.kind === "screen"
      ? entry
      : entry.kind === "use-case" && entry.steps[0]
        ? byId.get(entry.steps[0].screenId)
        : undefined;
  if (!screen || screen.kind !== "screen") return;
  return colorScheme === "dark"
    ? (screen.darkFragments?.[viewport] ?? screen.fragments[viewport])
    : screen.fragments[viewport];
}
