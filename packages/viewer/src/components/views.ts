import type { ColorScheme, Viewport } from "../data/axes.js";
import { viewRoute } from "../navigation/routes.js";
import type { ManifestEntry, ManifestScreen } from "../registry/types.js";
import { VIEWPORTS } from "../registry/views.js";

import type {
  ComponentViewRecord,
  ManifestComponent,
} from "./manifest_types.js";

export interface GeneratedComponentView {
  viewport: Viewport;
  colorScheme: ColorScheme;
  path: string;
  variantPath?: string;
  usage?: ComponentViewRecord;
}

/**
 * Derive the view documents of a screen or component entry. A component
 * parent renders its own props, so it has views like each of its variants.
 */
export function generatedViews(entry: ManifestEntry): GeneratedComponentView[] {
  if (entry.kind === "component") return fragmentViews(entry, entry.path);
  if (entry.kind === "screen") return fragmentViews(entry);
  return [];
}

/** Present logical instances by their first actual DOM occurrence, including slot replay. */
export function orderedInstances(usage?: ComponentViewRecord) {
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
function fragmentViews(
  entry: ManifestScreen | ManifestComponent,
  variantPath?: string,
): GeneratedComponentView[] {
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
