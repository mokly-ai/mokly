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
import type { ReviewState, ViewReview } from "../review/types.js";

import type { ShellContext } from "./context.js";
import { orderChangedViews, type ChangedView } from "./view_marks.js";
import type { ViewState, ViewStatesBySelection } from "./view_status.js";

/** Changed views keyed by saved-variant id for components and entry id for screens. */
export type ChangedViewsBySelection = Readonly<
  Record<string, readonly ChangedView[]>
>;

type ReviewedView = Pick<ViewReview, "colorScheme" | "state" | "viewport">;

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
  return orderChangedViews(
    (viewStates(entry, context, comparison, variantId) ?? [])
      .filter((view) => CHANGED_STATES.has(view.state))
      .map(({ colorScheme, viewport }) => ({ colorScheme, viewport })),
  );
}

/** Every known state for one screen or component saved variant. */
export function viewStates(
  entry: ManifestComponent | ManifestScreen,
  context: ShellContext,
  comparison: ComponentReview | ScreenReviewV3 | undefined,
  variantId?: string,
): readonly ViewState[] | undefined {
  return evidenceViews(entry, context, comparison, variantId)?.map(
    ({ colorScheme, state, viewport }) => ({ colorScheme, state, viewport }),
  );
}

/**
 * Derive every selection's evidence. Current and removed component variants
 * are both retained, including reviews that are not present in the manifest.
 */
export function changedViewsBySelection(
  entry: ManifestComponent | ManifestScreen,
  context: ShellContext,
  comparison: ComponentReview | ScreenReviewV3 | undefined,
  variantIds: readonly string[] = [],
): ChangedViewsBySelection {
  if (entry.kind === "screen")
    return { [entry.id]: changedViews(entry, context, comparison) };
  const reviewedIds =
    comparison && "variants" in comparison
      ? comparison.variants.map(({ id }) => id)
      : [];
  return Object.fromEntries(
    [
      ...new Set([
        ...entry.variants.map(({ id }) => id),
        ...variantIds,
        ...reviewedIds,
      ]),
    ].map((variantId) => [
      variantId,
      changedViews(entry, context, comparison, variantId),
    ]),
  );
}

/**
 * Key every selection's known states. Unknown selections are omitted so a
 * reader can preserve its route-level status instead of inventing evidence.
 */
export function viewStatesBySelection(
  entry: ManifestComponent | ManifestScreen,
  context: ShellContext,
  comparison: ComponentReview | ScreenReviewV3 | undefined,
  variantIds: readonly string[] = [],
): ViewStatesBySelection {
  if (entry.kind === "screen") {
    const states = viewStates(entry, context, comparison);
    return states === undefined ? {} : { [entry.id]: states };
  }
  const reviewedIds =
    comparison && "variants" in comparison
      ? comparison.variants.map(({ id }) => id)
      : [];
  const evidence: Record<string, readonly ViewState[]> = {};
  for (const variantId of new Set([
    ...entry.variants.map(({ id }) => id),
    ...variantIds,
    ...reviewedIds,
  ])) {
    const states = viewStates(entry, context, comparison, variantId);
    if (states !== undefined) evidence[variantId] = states;
  }
  return evidence;
}

/** Read the screen or selected saved variant without a caller inventing a key. */
export function selectedChangedViews(
  entry: ManifestComponent | ManifestScreen,
  evidence: ChangedViewsBySelection,
  variantId?: string,
): readonly ChangedView[] {
  const key = entry.kind === "screen" ? entry.id : variantId;
  return key ? (evidence[key] ?? []) : [];
}

function evidenceViews(
  entry: ManifestComponent | ManifestScreen,
  context: ShellContext,
  comparison: ComponentReview | ScreenReviewV3 | undefined,
  variantId?: string,
): readonly ReviewedView[] | undefined {
  const reviewed =
    comparison === undefined
      ? undefined
      : "variants" in comparison
        ? comparison.variants.find((item) => item.id === variantId)?.views
        : comparison.views;
  return (
    reviewed ??
    (entry.kind === "screen"
      ? context.componentChanges?.screenViews?.find(
          (item) => item.route === entry.route,
        )?.views
      : undefined)
  );
}
