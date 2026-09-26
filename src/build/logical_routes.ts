import type { ColorScheme, Viewport } from "@mokly/viewer";
import {
  componentFragmentRoute,
  entryRoute,
  effectiveColorSchemes,
  viewRoute,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";

/** Resolve a registry entry to the static artifact appropriate for a view. */
export function artifactRouteForEntry(
  entry: ResolvedRegistryEntry,
  viewport: Viewport,
  colorScheme: ColorScheme,
  byId: ReadonlyMap<string, ResolvedRegistryEntry>,
  catalogueSchemes: readonly ColorScheme[],
): string | undefined {
  if (entry.kind === "page") return entryRoute("page", entry.id);
  if (entry.kind === "component") {
    const scheme = effectiveColorSchemes(entry, catalogueSchemes).includes(
      colorScheme,
    )
      ? colorScheme
      : "light";
    return componentFragmentRoute(
      entryRoute("component", entry.id),
      entry.variants[0]!.id,
      viewport,
      scheme,
    );
  }
  const screen =
    entry.kind === "screen"
      ? entry
      : entry.kind === "use-case" && entry.steps[0]
        ? byId.get(entry.steps[0].screenId)
        : undefined;
  if (screen?.kind !== "screen") return undefined;
  const targetScheme = effectiveColorSchemes(screen, catalogueSchemes).includes(
    colorScheme,
  )
    ? colorScheme
    : "light";
  return viewRoute("screen", screen.id, viewport, targetScheme);
}

/** Map logical catalogue routes to concrete view artifacts. */
export function logicalArtifactRoutes(
  entries: readonly ResolvedRegistryEntry[],
  viewport: Viewport,
  colorScheme: ColorScheme,
  catalogueSchemes: readonly ColorScheme[],
): Readonly<Record<string, string>> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return Object.fromEntries(
    entries.flatMap((entry) => {
      const artifact = artifactRouteForEntry(
        entry,
        viewport,
        colorScheme,
        byId,
        catalogueSchemes,
      );
      return artifact
        ? [[entryRoute(entry.kind, entry.id), artifact] as const]
        : [];
    }),
  );
}
