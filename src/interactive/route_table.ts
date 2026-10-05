import type {
  ColorScheme,
  ManifestComponentVariant,
  Viewport,
} from "@mokly/viewer";
import {
  effectiveColorSchemes,
  entryRoute,
  documentRoute,
  isManifestComponentVariant,
  viewRoute,
  type ManifestEntry,
} from "@mokly/viewer/data";

import { portableArtifactHref } from "../build/mock_link_routes.js";

import type { InteractiveRouteTable } from "./types.js";

/** Retained-manifest entry accepted by Live document composition. */
export type InteractiveSourceEntry<
  Entry extends ManifestEntry = ManifestEntry,
> = Entry extends unknown ? Entry & { interactive?: boolean } : never;

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
  const byId = new Map(input.entries.map((entry) => [entry.path, entry]));
  const routed = [...input.entries].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
  const routes: Record<string, InteractiveRouteTable[string]> = {};
  for (const entry of routed) {
    const artifact = manifestArtifactRoute(
      entry,
      input.viewport,
      input.colorScheme,
      byId,
      input.entries,
      input.catalogueSchemes,
    );
    if (!artifact) continue;
    routes[entry.path] = {
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
  entries: readonly InteractiveSourceEntry[],
  catalogueSchemes: readonly ColorScheme[],
): string | undefined {
  if (entry.kind === "document")
    return documentRoute(
      entry.path,
      entry.colorSchemes.includes(colorScheme) ? colorScheme : "light",
    );
  if (entry.kind === "page") return entryRoute(entry.path);
  if (entry.kind === "component") {
    const variant = isManifestComponentVariant(entry)
      ? entry
      : entries.find(
          (
            candidate,
          ): candidate is InteractiveSourceEntry<ManifestComponentVariant> =>
            candidate.kind === "component" &&
            isManifestComponentVariant(candidate) &&
            candidate.variantOf === entry.path,
        );
    if (!variant) return;
    const scheme = effectiveColorSchemes(variant, catalogueSchemes).includes(
      colorScheme,
    )
      ? colorScheme
      : "light";
    return viewRoute(variant.path, viewport, scheme);
  }
  const screen =
    entry.kind === "screen"
      ? entry
      : entry.kind === "use-case" && entry.steps[0]
        ? byId.get(entry.steps[0].screenPath)
        : undefined;
  if (!screen || screen.kind !== "screen") return;
  const scheme = effectiveColorSchemes(screen, catalogueSchemes).includes(
    colorScheme,
  )
    ? colorScheme
    : "light";
  return viewRoute(screen.path, viewport, scheme);
}
