import path from "node:path";

import type { ColorScheme, Viewport } from "@mokly/viewer";
import {
  encodeUrlPath,
  entryRoute,
  effectiveColorSchemes,
  type LogicalTarget,
  viewRoute,
} from "@mokly/viewer/data";

import type { ResolvedRegistryEntry } from "../authoring/types.js";
import {
  isComponentVariantDefinition,
  type ComponentVariantDefinition,
} from "../components/types.js";

/** Resolve a registry entry to the static artifact appropriate for a view. */
export function artifactRouteForEntry(
  entry: ResolvedRegistryEntry,
  viewport: Viewport,
  colorScheme: ColorScheme,
  byPath: ReadonlyMap<string, ResolvedRegistryEntry>,
  catalogueSchemes: readonly ColorScheme[],
): string | undefined {
  if (entry.kind === "page") return entryRoute(entry.path);
  if (entry.kind === "component") {
    const variant = isComponentVariantDefinition(entry)
      ? entry
      : [...byPath.values()].find(
          (
            candidate,
          ): candidate is ResolvedRegistryEntry & ComponentVariantDefinition =>
            candidate.kind === "component" &&
            isComponentVariantDefinition(candidate) &&
            candidate.variantOf === entry.path,
        );
    if (!variant) return undefined;
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
        ? byPath.get(entry.steps[0].screenPath)
        : undefined;
  if (screen?.kind !== "screen") return undefined;
  const targetScheme = effectiveColorSchemes(screen, catalogueSchemes).includes(
    colorScheme,
  )
    ? colorScheme
    : "light";
  return viewRoute(screen.path, viewport, targetScheme);
}

/** Encode one logical destination relative to its generated source document. */
export function portableMockTarget(
  sourceRoute: string,
  targetRoute: string,
  target: LogicalTarget,
): string {
  const relative = path.posix.relative(
    path.posix.dirname(sourceRoute),
    targetRoute,
  );
  const encoded = encodeUrlPath(relative);
  const route = encoded.startsWith(".") ? encoded : `./${encoded}`;
  return `${route}${target.fragment ? `#${target.fragment}` : ""}`;
}
