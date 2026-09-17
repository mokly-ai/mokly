/** View enumeration and aggregation helpers for Review screen comparisons. */

import type { ColorScheme, Viewport } from "@mokly/viewer";
import { VIEWPORTS } from "@mokly/viewer/data";
import type {
  ManifestScreen,
  ReviewResult,
  ReviewState,
  ScreenReview,
} from "@mokly/viewer/data";

const COLOR_SCHEMES: readonly ColorScheme[] = ["light", "dark"];
const COLOR_SCHEME_RANK: Readonly<Record<ColorScheme, number>> = {
  dark: 1,
  light: 0,
};
const VIEWPORT_RANK: Readonly<Record<Viewport, number>> = {
  desktop: 1,
  mobile: 0,
};

/** List every generated fragment route declared by a manifest screen. */
export function fragmentRoutes(screen: ManifestScreen): string[] {
  return VIEWPORTS.flatMap((viewport) =>
    COLOR_SCHEMES.flatMap(
      (colorScheme) => fragmentForView(screen, viewport, colorScheme) ?? [],
    ),
  );
}

/** Resolve the manifest fragment for one viewport and color scheme. */
export function fragmentForView(
  screen: ManifestScreen,
  viewport: Viewport,
  colorScheme: ColorScheme,
): string | undefined {
  return colorScheme === "light"
    ? screen.fragments[viewport]
    : screen.darkFragments?.[viewport];
}

/** Return the canonical color-scheme union for a base/head screen pair. */
export function unionColorSchemes(
  base: ManifestScreen | undefined,
  head: ManifestScreen | undefined,
): readonly ColorScheme[] {
  const schemes = new Set([
    ...screenColorSchemes(base),
    ...screenColorSchemes(head),
  ]);
  return COLOR_SCHEMES.filter((colorScheme) => schemes.has(colorScheme));
}

/** Return the color schemes represented by one manifest screen. */
export function screenColorSchemes(
  screen: ManifestScreen | undefined,
): readonly ColorScheme[] {
  return screen?.darkFragments ? ["light", "dark"] : ["light"];
}

/** Aggregate ignored regions in canonical viewport, scheme, then id order. */
export function aggregateIgnored(
  screens: readonly ScreenReview[],
): ReviewResult["ignoredImpact"] {
  const counts = new Map<string, number>();
  for (const screen of screens) {
    for (const view of screen.views) {
      for (const id of view.ignoredIds) {
        const key = `${view.viewport}:${view.colorScheme}:${id}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts]
    .map(([key, count]) => {
      const [viewport, colorScheme, ...id] = key.split(":");
      return {
        colorScheme: colorScheme as ColorScheme,
        count,
        id: id.join(":"),
        viewport: viewport as Viewport,
      };
    })
    .sort(
      (left, right) =>
        VIEWPORT_RANK[left.viewport] - VIEWPORT_RANK[right.viewport] ||
        COLOR_SCHEME_RANK[left.colorScheme] -
          COLOR_SCHEME_RANK[right.colorScheme] ||
        left.id.localeCompare(right.id),
    );
}

export function aggregateState(states: readonly ReviewState[]): ReviewState {
  for (const state of [
    "changed",
    "added",
    "removed",
    "ignored-only",
    "unchanged",
  ] as const) {
    if (states.includes(state)) return state;
  }
  return "unchanged";
}
