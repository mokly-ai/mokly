// Which of an entry's generated views a classification marks changed. A ready
// comparison result is authoritative; legacy or pending evidence without a
// result falls back to the per-view decisions the same classification pass
// records. Unknown evidence stays an empty list, so the workspace never claims
// a view is unmodified when it has not examined one.

import type { BranchPointPath, CurrentPath } from "../catalogue/path_types.js";
import type {
  ManifestComponent,
  ManifestComponentVariant,
} from "../components/manifest_types.js";
import type { ManifestScreen } from "../registry/types.js";
import type {
  ComponentReview,
  ScreenReviewV5,
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
 * The views this entry changed in, in canonical order. `variantPath` selects a
 * component's saved variant; a screen ignores it.
 */
export function changedViews(
  entry:
    | ManifestComponent<CurrentPath>
    | ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>
    | ManifestScreen<CurrentPath, CurrentPath | BranchPointPath>,
  context: ShellContext,
  comparison:
    | ComponentReview<CurrentPath, BranchPointPath>
    | ScreenReviewV5<CurrentPath, BranchPointPath>
    | undefined,
  variantPath?: string,
): readonly ChangedView[] {
  return orderChangedViews(
    (viewStates(entry, context, comparison, variantPath) ?? [])
      .filter((view) => CHANGED_STATES.has(view.state))
      .map(({ colorScheme, viewport }) => ({ colorScheme, viewport })),
  );
}

/** Every known state for one screen or component saved variant. */
export function viewStates(
  entry:
    | ManifestComponent<CurrentPath>
    | ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>
    | ManifestScreen<CurrentPath, CurrentPath | BranchPointPath>,
  context: ShellContext,
  comparison:
    | ComponentReview<CurrentPath, BranchPointPath>
    | ScreenReviewV5<CurrentPath, BranchPointPath>
    | undefined,
  variantPath?: string,
): readonly ViewState[] | undefined {
  return evidenceViews(entry, context, comparison, variantPath)?.map(
    ({ colorScheme, state, viewport }) => ({ colorScheme, state, viewport }),
  );
}

/**
 * Derive every selection's evidence. Current and removed component variants
 * are both retained, including reviews that are not present in the manifest.
 */
export function changedViewsBySelection(
  entry:
    | ManifestComponent<CurrentPath>
    | ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>
    | ManifestScreen<CurrentPath, CurrentPath | BranchPointPath>,
  context: ShellContext,
  comparison:
    | ComponentReview<CurrentPath, BranchPointPath>
    | ScreenReviewV5<CurrentPath, BranchPointPath>
    | undefined,
  variantIds: readonly string[] = [],
): ChangedViewsBySelection {
  if (entry.kind === "screen")
    return { [entry.path]: changedViews(entry, context, comparison) };
  const reviewedIds =
    comparison && "variants" in comparison
      ? comparison.variants.map(({ path }) => path)
      : [];
  return Object.fromEntries(
    [...new Set([...variantIds, ...reviewedIds])].map((variantPath) => [
      variantPath,
      changedViews(entry, context, comparison, variantPath),
    ]),
  );
}

/**
 * Key every selection's known states. Unknown selections are omitted so a
 * reader can preserve its route-level status instead of inventing evidence.
 */
export function viewStatesBySelection(
  entry:
    | ManifestComponent<CurrentPath>
    | ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>
    | ManifestScreen<CurrentPath, CurrentPath | BranchPointPath>,
  context: ShellContext,
  comparison:
    | ComponentReview<CurrentPath, BranchPointPath>
    | ScreenReviewV5<CurrentPath, BranchPointPath>
    | undefined,
  variantIds: readonly string[] = [],
): ViewStatesBySelection {
  if (entry.kind === "screen") {
    const states = viewStates(entry, context, comparison);
    return states === undefined
      ? (Object.create(null) as Record<string, readonly ViewState[]>)
      : { [entry.path]: states };
  }
  const reviewedIds =
    comparison && "variants" in comparison
      ? comparison.variants.map(({ path }) => path)
      : [];
  const evidence: Record<string, readonly ViewState[]> = Object.create(null);
  for (const variantPath of new Set([...variantIds, ...reviewedIds])) {
    const states = viewStates(entry, context, comparison, variantPath);
    if (states !== undefined) evidence[variantPath] = states;
  }
  return evidence;
}

/** Read the screen or selected saved variant without a caller inventing a key. */
export function selectedChangedViews(
  entry:
    | ManifestComponent<CurrentPath>
    | ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>
    | ManifestScreen<CurrentPath, CurrentPath | BranchPointPath>,
  evidence: ChangedViewsBySelection,
  variantPath?: string,
): readonly ChangedView[] {
  const key = entry.kind === "screen" ? entry.path : variantPath;
  return key && Object.hasOwn(evidence, key) ? (evidence[key] ?? []) : [];
}

function evidenceViews(
  entry:
    | ManifestComponent<CurrentPath>
    | ManifestComponentVariant<CurrentPath, CurrentPath | BranchPointPath>
    | ManifestScreen<CurrentPath, CurrentPath | BranchPointPath>,
  context: ShellContext,
  comparison:
    | ComponentReview<CurrentPath, BranchPointPath>
    | ScreenReviewV5<CurrentPath, BranchPointPath>
    | undefined,
  variantPath?: string,
): readonly ReviewedView[] | undefined {
  const reviewed =
    comparison === undefined
      ? undefined
      : "variants" in comparison
        ? comparison.variants.find((item) => item.path === variantPath)?.views
        : comparison.views;
  return (
    reviewed ??
    (entry.kind === "screen"
      ? context.componentChanges?.screenViews?.find(
          (item) => item.path === entry.path,
        )?.views
      : undefined)
  );
}
