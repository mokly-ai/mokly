/** Typed parsing for explicit viewport and color-scheme route axes. */

import type { ColorScheme, Viewport } from "../data/axes.js";

/** Valid axes explicitly named by one route query. */
export interface ExplicitViewAxes {
  colorScheme?: ColorScheme;
  viewport?: "both" | Viewport;
}

/** Parse each axis independently; invalid or repeated values are omitted. */
export function parseViewAxes(search: URLSearchParams): ExplicitViewAxes {
  const viewport = oneOf(search, "viewport", ["both", "desktop", "mobile"]);
  const colorScheme = oneOf(search, "scheme", ["dark", "light"]);
  return {
    ...(viewport ? { viewport } : {}),
    ...(colorScheme ? { colorScheme } : {}),
  };
}

function oneOf<const Value extends string>(
  search: URLSearchParams,
  name: string,
  supported: readonly Value[],
): Value | undefined {
  const values = search.getAll(name);
  if (values.length !== 1) return undefined;
  const value = values[0];
  return supported.find((candidate) => candidate === value);
}
