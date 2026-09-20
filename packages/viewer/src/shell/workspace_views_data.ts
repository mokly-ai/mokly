// Which of an entry's generated views a classification marks changed. A ready
// comparison result is authoritative; a screen-only catalogue, which never
// generates comparisons, falls back to the per-view decisions the same
// classification pass records. Unknown evidence stays an empty list, so the
// workspace never claims a view is unmodified when it has not examined one.

import type { ManifestComponent } from "../components/manifest_types.js";
import type { ManifestScreen } from "../registry/types.js";
import type {
  ComponentReview,
  ScreenReviewV3,
} from "../review/component_types.js";
import type { ReviewState } from "../review/types.js";

import type { ShellContext } from "./context.js";
import { orderChangedViews, type ChangedView } from "./view_marks.js";

/** States that put a view in front of a reviewer; `ignored-only` does not. */
const CHANGED_STATES: ReadonlySet<ReviewState> = new Set<ReviewState>([
  "added",
  "changed",
  "removed",
]);

/**
 * The views this entry changed in, in canonical order. `variantId` selects a
 * component's saved variant; a screen ignores it.
 */
export function changedViews(
  entry: ManifestComponent | ManifestScreen,
  context: ShellContext,
  comparison: ComponentReview | ScreenReviewV3 | undefined,
  variantId?: string,
): readonly ChangedView[] {
  const reviewed =
    comparison === undefined
      ? undefined
      : "variants" in comparison
        ? comparison.variants.find((item) => item.id === variantId)?.views
        : comparison.views;
  const views =
    reviewed ??
    (entry.kind === "screen"
      ? context.componentChanges?.screenViews?.find(
          (item) => item.route === entry.route,
        )?.views
      : undefined);
  return orderChangedViews(
    (views ?? [])
      .filter((view) => CHANGED_STATES.has(view.state))
      .map(({ colorScheme, viewport }) => ({ colorScheme, viewport })),
  );
}
