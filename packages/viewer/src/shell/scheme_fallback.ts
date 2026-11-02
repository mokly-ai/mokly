/**
 * The Light-only fallback of whole documents, which have no frame label.
 * `@mokly/ui/scheme-fallback` draws the band and the note.
 */

import type { ColorScheme } from "../data/axes.js";

/** Keep the requested scheme, with Light as the fallback for a missing Dark view. */
export function schemeValue<T>(
  requested: ColorScheme,
  light: T,
  dark: T | undefined,
): T {
  return requested === "dark" ? (dark ?? light) : light;
}

/**
 * Whether a document keeps its light page under Dark: it has no dark render
 * while the catalogue has a dark axis. A wholly light-only catalogue names no
 * fallback, because no dark axis exists.
 */
export function documentLightOnly(
  entry: { kind: string; colorSchemes?: readonly string[] },
  hasDarkFragments: boolean,
): boolean {
  return (
    entry.kind === "document" &&
    hasDarkFragments &&
    !(entry.colorSchemes ?? []).includes("dark")
  );
}
