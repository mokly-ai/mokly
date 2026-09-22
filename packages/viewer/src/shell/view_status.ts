import type { ColorScheme, Viewport } from "../data/axes.js";
import type { ReviewState } from "../review/types.js";

/** Product-facing state shown beside a workspace title. */
export type EntryStatus = "Added" | "Changed" | "Removed" | "Unmodified";

/** Review state for one generated viewport and color-scheme view. */
export interface ViewState {
  viewport: Viewport;
  colorScheme: ColorScheme;
  state: ReviewState;
}

/** Per-view states keyed by screen id or component saved-variant id. */
export type ViewStatesBySelection = Readonly<
  Record<string, readonly ViewState[]>
>;

/** Status and eligibility resolved from one complete displayed-view decision. */
export interface ViewPresentation {
  comparisonEligible: boolean;
  evidence: "fallback" | "matching";
  status: EntryStatus | undefined;
}

/**
 * Use per-view evidence only when it covers every displayed view. Otherwise
 * retain route/saved-variant status and eligibility as one fallback decision.
 */
export function resolveViewPresentation({
  displayedViews,
  fallbackComparisonEligible,
  fallbackStatus,
  kind,
  states,
}: {
  displayedViews: readonly Pick<ViewState, "colorScheme" | "viewport">[];
  fallbackComparisonEligible: boolean;
  fallbackStatus: EntryStatus | undefined;
  kind: "component" | "screen";
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
  const status = aggregateStatus(
    selected.map((state) => entryStatus(state!.state)),
    fallbackStatus,
  );
  return {
    comparisonEligible: shownComparisonEligible(status, kind),
    evidence: "matching",
    status,
  };
}

/**
 * Resolve the status for the shown view. Missing evidence preserves the
 * route-level fallback; Both aggregates Changed, Added, Removed, Unmodified.
 */
export function shownStatus(
  states: readonly ViewState[] | undefined,
  viewport: "both" | Viewport,
  scheme: ColorScheme,
  fallback: EntryStatus | undefined,
): EntryStatus | undefined {
  if (states === undefined || states.length === 0) return fallback;
  const selected = states.filter(
    (view) =>
      view.colorScheme === scheme &&
      (viewport === "both" || view.viewport === viewport),
  );
  if (selected.length === 0) return fallback;
  return aggregateStatus(
    selected.map(({ state }) => entryStatus(state)),
    fallback,
  );
}

/** Apply the shared comparison rule to a route-level or shown-view status. */
export function shownComparisonEligible(
  status: EntryStatus | undefined,
  kind: "component" | "screen",
): boolean {
  return status === "Changed" || (kind === "component" && status === "Removed");
}

function entryStatus(state: ReviewState): EntryStatus {
  if (state === "changed") return "Changed";
  if (state === "added") return "Added";
  if (state === "removed") return "Removed";
  return "Unmodified";
}

function aggregateStatus(
  statuses: readonly EntryStatus[],
  fallback: EntryStatus | undefined,
): EntryStatus | undefined {
  return (
    (["Changed", "Added", "Removed", "Unmodified"] as const).find((status) =>
      statuses.includes(status),
    ) ?? fallback
  );
}
