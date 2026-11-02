import type {
  ShellCatalogueRoutedEntry,
  ShellCatalogueScreen,
  ShellCatalogueComponent,
} from "../catalogue/scoped_types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";
import { viewRoute } from "../navigation/routes.js";

import type { ComponentViewRecord } from "./view_types.js";

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
export function generatedViews(
  entry: ShellCatalogueRoutedEntry,
): GeneratedComponentView[] {
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

/** Add routes and detail usage to the index's ordered view list. */
function fragmentViews(
  entry: ShellCatalogueScreen | ShellCatalogueComponent,
  variantPath?: string,
): GeneratedComponentView[] {
  return entry.views.map((view) => {
    const { viewport, colorScheme } = view;
    const usage: ComponentViewRecord | undefined =
      view.usage.status === "ready"
        ? {
            viewport,
            colorScheme,
            instances: view.usage.instances,
            slots: view.usage.slots,
            ranges: view.usage.ranges,
            styles: [],
            resources: [],
          }
        : undefined;
    return {
      viewport,
      colorScheme,
      path: viewRoute(entry.path, viewport, colorScheme),
      ...(usage ? { usage } : {}),
      ...(variantPath ? { variantPath } : {}),
    };
  });
}
