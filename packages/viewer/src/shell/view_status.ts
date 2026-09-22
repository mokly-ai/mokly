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

/** Aggregate a complete set of shown view states in product priority order. */
export function aggregateViewStatus(
  states: readonly ViewState[],
): EntryStatus | undefined {
  const statuses = states.map(({ state }) => entryStatus(state));
  return (["Changed", "Added", "Removed", "Unmodified"] as const).find(
    (status) => statuses.includes(status),
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
