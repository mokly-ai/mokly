import type { ColorScheme, Viewport } from "../data/axes.js";
import type { ManifestEntry, ManifestScreen } from "../registry/types.js";
import { VIEWPORTS } from "../registry/views.js";

import type {
  ComponentViewRecord,
  ManifestComponentVariant,
} from "./manifest_types.js";

export interface GeneratedComponentView {
  viewport: Viewport;
  colorScheme: ColorScheme;
  path: string;
  variantId?: string;
  usage?: ComponentViewRecord;
}

/** Enumerate actual artifacts, preserving the distinction between absent and empty usage. */
export function generatedViews(entry: ManifestEntry): GeneratedComponentView[] {
  if (entry.kind === "component")
    return entry.variants.flatMap((variant) =>
      fragmentViews(variant, variant.id),
    );
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

export function fragmentViews(
  fragments:
    | Pick<ManifestScreen, "fragments" | "darkFragments" | "componentViews">
    | ManifestComponentVariant,
  variantId?: string,
): GeneratedComponentView[] {
  return VIEWPORTS.flatMap((viewport) => {
    const makeView = (
      colorScheme: ColorScheme,
      path: string,
    ): GeneratedComponentView => {
      const usage = fragments.componentViews?.find(
        (view) =>
          view.viewport === viewport && view.colorScheme === colorScheme,
      );
      return {
        viewport,
        colorScheme,
        path,
        ...(usage ? { usage } : {}),
        ...(variantId ? { variantId } : {}),
      };
    };
    return [
      makeView("light", fragments.fragments[viewport]),
      ...(fragments.darkFragments
        ? [makeView("dark", fragments.darkFragments[viewport])]
        : []),
    ];
  });
}
