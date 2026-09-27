/** The interface appearance a viewer root draws, independent of its previews. */

import type { ViewerTheme } from "./types.js";

/** The value a root's `data-mokly-theme` carries. */
export const THEME_ATTRIBUTE = "data-mokly-theme";

/**
 * Untyped JavaScript can supply anything, and an unusable value must not cost
 * the reader their catalogue, so it resolves to Auto rather than failing.
 */
export function normalizeTheme(theme: unknown): ViewerTheme {
  return theme === "dark" || theme === "light" || theme === "auto"
    ? theme
    : "auto";
}

/** Root attributes stating the appearance, spread onto every viewer root. */
export function themeAttributes(theme: unknown): { [THEME_ATTRIBUTE]: string } {
  return { [THEME_ATTRIBUTE]: normalizeTheme(theme) };
}
