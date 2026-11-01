// Per-view change evidence for the workspace view controls: the two axes that
// name a generated view, their labels, and the rule that
// decides whether the viewport and theme controls carry a mark. The shell
// renders the controls from this rule and re-applies it whenever the shown
// viewport or scheme changes, so every render agrees without a second state
// channel.

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

const VIEWPORT_LABELS = { desktop: "Desktop", mobile: "Mobile" } as const;
/** Each colour scheme named for the reader. */
export const SCHEME_LABELS = { dark: "Dark", light: "Light" } as const;

/** The changed views named for a reader, for example `Mobile · Dark, Desktop · Dark`. */
export function changedViewsLabel(views: readonly ChangedView[]): string {
  return views
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
