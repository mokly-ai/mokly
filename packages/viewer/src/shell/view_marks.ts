// Per-view change evidence for the workspace view controls: the two axes that
// name a generated view, the order those views are read in, and the rule that
// decides whether the viewport and theme controls carry a mark. The shell
// renders the controls from this rule and the Browse client re-applies it
// whenever the shown viewport or scheme changes, so the served markup and
// every client update agree without a second state channel.

import type { ColorScheme, Viewport } from "../data/axes.js";

/** One generated view of an entry, named by its viewport and color scheme. */
export interface ChangedView {
  colorScheme: ColorScheme;
  viewport: Viewport;
}

/** Whether each view control points at a changed view other than the shown one. */
export interface ViewMarks {
  scheme: boolean;
  viewport: boolean;
}

/** Class the stylesheet draws as the accent dot on a marked control. */
export const VIEW_CHANGED_CLASS = "mbk-view-changed";

/** Class the stylesheet clips to the wording a screen reader hears. */
export const VIEW_CHANGED_TEXT_CLASS = "mbk-view-changed-text";

/** Element ids a marked control names through `aria-describedby`. */
export const VIEW_CHANGED_IDS = {
  scheme: "mb-view-changed-scheme",
  viewport: "mb-view-changed-viewport",
} as const;

/** What a screen reader announces as a marked control's description. */
export const VIEW_CHANGED_TEXT = {
  scheme: "Other theme changed",
  viewport: "Other viewport changed",
} as const;

const VIEW_ORDER: readonly ChangedView[] = [
  { viewport: "mobile", colorScheme: "light" },
  { viewport: "mobile", colorScheme: "dark" },
  { viewport: "desktop", colorScheme: "light" },
  { viewport: "desktop", colorScheme: "dark" },
];
const VIEWPORT_LABELS = { desktop: "Desktop", mobile: "Mobile" } as const;
const SCHEME_LABELS = { dark: "Dark", light: "Light" } as const;

/** The same views in one canonical order, deduplicated: mobile before desktop
 * and light before dark, so two catalogues never name them differently. */
export function orderChangedViews(
  views: readonly ChangedView[],
): readonly ChangedView[] {
  return VIEW_ORDER.filter((candidate) =>
    views.some(
      (view) =>
        view.viewport === candidate.viewport &&
        view.colorScheme === candidate.colorScheme,
    ),
  );
}

/** The changed views named for a reader, for example `Mobile · Dark, Desktop · Dark`. */
export function changedViewsLabel(views: readonly ChangedView[]): string {
  return orderChangedViews(views)
    .map(
      (view) =>
        `${VIEWPORT_LABELS[view.viewport]} · ${SCHEME_LABELS[view.colorScheme]}`,
    )
    .join(", ");
}

/**
 * A control is marked only when a changed view is one the reader cannot
 * currently see: the theme control when a changed view uses the other scheme,
 * and the viewport control when a changed view uses the other viewport.
 * Selecting both viewports shows every viewport at once, so nothing is hidden
 * behind that control and it is never marked.
 */
export function viewMarks(
  views: readonly ChangedView[],
  viewport: "both" | Viewport,
  scheme: ColorScheme,
): ViewMarks {
  return {
    scheme: views.some((view) => view.colorScheme !== scheme),
    viewport:
      viewport !== "both" && views.some((view) => view.viewport !== viewport),
  };
}
