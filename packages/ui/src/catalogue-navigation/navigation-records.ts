/**
 * The plain records of the catalogue column's filter and status line. The
 * host builds them from its change detection and its state.
 */

/** The state of change detection that the filter and the status show. */
export type NavigationChangesStatus =
  "pending" | "preparing" | "ready" | "unavailable";

/** The All and Changes filter above the tree. */
export interface NavigationFilter {
  status: NavigationChangesStatus;
  /** The filter that the tree applies. */
  view: "all" | "changes";
  /** The number of changed entries, shown once detection is ready. */
  count?: number | undefined;
}

/** The message that the tree shows under Changes in place of rows. */
export type NavigationStatusMessage =
  "none" | "pending" | "preparing" | "unavailable" | "unmatched";

/** The status line at the top of the tree. */
export interface NavigationStatus {
  message: NavigationStatusMessage;
  hidden: boolean;
}
