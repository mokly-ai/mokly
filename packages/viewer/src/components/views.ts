import type { ColorScheme, Viewport } from "../data/axes.js";
import { viewRoute } from "../navigation/routes.js";
import type { ManifestEntry, ManifestScreen } from "../registry/types.js";
import { VIEWPORTS } from "../registry/views.js";

import type {
  ComponentViewRecord,
  ManifestComponentVariant,
} from "./manifest_types.js";
import { isManifestComponentVariant } from "./manifest_types.js";

export interface GeneratedComponentView<
  Path extends string = string,
  Reference extends string = Path,
> {
  viewport: Viewport;
  colorScheme: ColorScheme;
  path: string;
  variantPath?: Path;
  usage?: ComponentViewRecord<Reference>;
}

/** Derive current and historical-v7 artifacts from identity and view axes. */
export function generatedViews<Path extends string, Reference extends string>(
  entry: ManifestEntry<Path, Reference>,
): GeneratedComponentView<Path, Reference>[] {
  if (entry.kind === "component")
    return isManifestComponentVariant(entry)
      ? fragmentViews(entry, entry.path)
      : [];
  if (entry.kind === "screen") return fragmentViews(entry);
  return [];
}

/** Present logical instances by their first actual DOM occurrence, including slot replay. */
export function orderedInstances<Reference extends string>(
  usage?: ComponentViewRecord<Reference>,
) {
  if (!usage) return [];
  const positions = new Map<string, number>();
  for (const range of usage.ranges)
    if (
      range.target.kind === "instance" &&
      !positions.has(range.target.instanceKey)
    )
      positions.set(range.target.instanceKey, positions.size);
  return [...usage.instances].sort(
    (a, b) => positions.get(a.key)! - positions.get(b.key)!,
  );
}

/** Derive current view artifacts from entry identity and retained axes. */
export function fragmentViews<Path extends string, Reference extends string>(
  entry:
    ManifestScreen<Path, Reference> | ManifestComponentVariant<Path, Reference>,
  variantPath?: Path,
): GeneratedComponentView<Path, Reference>[] {
  return VIEWPORTS.flatMap((viewport) =>
    entry.colorSchemes.map((colorScheme) => {
      const usage = entry.componentViews?.find(
        (view) =>
          view.viewport === viewport && view.colorScheme === colorScheme,
      );
      return {
        viewport,
        colorScheme,
        path: viewRoute(entry.path, viewport, colorScheme),
        ...(usage ? { usage } : {}),
        ...(variantPath ? { variantPath } : {}),
      };
    }),
  );
}
