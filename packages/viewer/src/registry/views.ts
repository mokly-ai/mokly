/** Shared view-axis helpers for generated screen artifacts. */

import type { ColorScheme, Viewport } from "../data/axes.js";

/** Recorded view axes for one generated screen artifact route. */
export interface ArtifactView {
  colorScheme: ColorScheme;
  viewport: Viewport;
}

/** Ordered viewports shared by every generated screen. */
export const VIEWPORTS: readonly Viewport[] = ["mobile", "desktop"];
