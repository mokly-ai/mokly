/** Shared view-axis helpers for generated screen artifacts. */

import type { ColorScheme, Viewport } from "../data/axes.js";

/** Recorded view axes for one generated screen artifact route. */
export interface ArtifactView {
  colorScheme: ColorScheme;
  viewport: Viewport;
}

/** Ordered viewports shared by every generated screen. */
export const VIEWPORTS: readonly Viewport[] = ["mobile", "desktop"];

/** Resolve a screen's effective schemes against the catalogue default. */
export function effectiveColorSchemes(
  entry: { colorSchemes?: readonly ColorScheme[] },
  catalogueSchemes: readonly ColorScheme[],
): readonly ColorScheme[] {
  return entry.colorSchemes ?? catalogueSchemes;
}
