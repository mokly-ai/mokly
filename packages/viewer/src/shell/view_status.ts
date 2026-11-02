import type { CatalogueView, ComparisonSelection } from "../catalogue/types.js";

/** Product-facing state shown beside a workspace title. */
export type EntryStatus = "Added" | "Changed" | "Removed" | "Unmodified";

/** The ready comparison of one index view, with its original axes. */
export type ViewState = Pick<CatalogueView, "viewport" | "colorScheme"> & {
  comparison: Extract<ComparisonSelection, { status: "ready" }>;
};

/** Per-view states keyed by screen or saved-component-variant path. */
export type ViewStatesBySelection = Readonly<
  Record<string, readonly ViewState[]>
>;

/** Status and eligibility resolved from one complete displayed-view decision. */
export interface ViewPresentation {
  comparisonEligible: boolean;
  evidence: "fallback" | "matching";
  status: EntryStatus | undefined;
}

const STATUS_LABELS = {
  changed: "Changed",
  added: "Added",
  removed: "Removed",
  unmodified: "Unmodified",
} as const satisfies Record<ViewState["comparison"]["kind"], EntryStatus>;

/**
 * Use index comparisons only when they cover every displayed view. Otherwise
 * retain route/saved-variant status and eligibility as one fallback decision.
 * Both uses Changed, Added, Removed, Unmodified priority and reads eligibility
 * from the comparison that supplies that status.
 */
export function resolveViewPresentation({
  displayedViews,
  fallbackComparisonEligible,
  fallbackStatus,
  states,
}: {
  displayedViews: readonly Pick<ViewState, "colorScheme" | "viewport">[];
  fallbackComparisonEligible: boolean;
  fallbackStatus: EntryStatus | undefined;
  states: readonly ViewState[] | undefined;
}): ViewPresentation {
  const selected = displayedViews.map((displayed) =>
    states?.find(
      (state) =>
        state.viewport === displayed.viewport &&
        state.colorScheme === displayed.colorScheme,
    ),
  );
  if (
    displayedViews.length === 0 ||
    selected.some((state) => state === undefined)
  )
    return {
      comparisonEligible: fallbackComparisonEligible,
      evidence: "fallback",
      status: fallbackStatus,
    };
  const comparison = (["changed", "added", "removed", "unmodified"] as const)
    .map((kind) => selected.find((view) => view?.comparison.kind === kind))
    .find((view) => view !== undefined)!.comparison;
  return {
    comparisonEligible: comparison.eligible,
    evidence: "matching",
    status: STATUS_LABELS[comparison.kind],
  };
}
