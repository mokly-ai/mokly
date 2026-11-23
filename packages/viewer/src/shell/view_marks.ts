// Per-view change evidence: the two axes that name a generated view, their
// labels, the wording of the marks that the Frames filter's toggles carry
// while they hide a changed view, and the id of the Appearance's mark.

import type { ColorScheme, Viewport } from "@mokly/model";

/** One generated view of an entry, named by its viewport and color scheme. */

export interface ChangedView {
  colorScheme: ColorScheme;
  viewport: Viewport;
}

/**
 * The id of the standalone Appearance's mark wording, which the marked
 * control names through `aria-describedby`.
 */
export const VIEW_CHANGED_IDS = {
  scheme: "mb-view-changed-scheme",
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
