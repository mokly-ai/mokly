/**
 * The All and Changes filter above the tree and the status line at its top.
 * They tell a detection that still runs, or that failed, from a real empty
 * result.
 */

import type {
  NavigationFilter,
  NavigationStatus,
  NavigationStatusMessage,
} from "./navigation-records.js";

/**
 * The copy of the two states that still work. `spinner` names the spinner
 * in the count slot; only `preparing` adds a detail line below its title.
 */
const CHANGES_MESSAGES = {
  pending: { title: "Checking for changes…", spinner: "Checking for changes" },
  preparing: {
    title: "Preparing comparison",
    spinner: "Preparing comparison",
    detail: "This takes a moment. You can keep browsing All while it finishes.",
  },
} as const;

/** The status line of each message but `preparing`, which has two lines. */
const STATUS_TEXT: Record<
  Exclude<NavigationStatusMessage, "preparing">,
  string
> = {
  none: "No changes found.",
  pending: CHANGES_MESSAGES.pending.title,
  unavailable: "Changes are unavailable. You can still browse All.",
  unmatched: "No matching changes.",
};

/**
 * The filter group. The count slot holds the number of changed entries once
 * detection is ready, a dash when it failed, and otherwise a spinner whose
 * status names the work that runs.
 */
export function FilterGroup({
  filter,
  onView,
}: {
  filter: NavigationFilter;
  onView: ((view: "all" | "changes") => void) | undefined;
}) {
  const { status } = filter;
  return (
    <div
      aria-label="Catalogue filter"
      className="mbk-nav-filter mbk-reset"
      data-mokly-filter=""
      data-changes-status={status}
      role="group"
    >
      <button
        aria-pressed={filter.view === "all"}
        className="mbk-nav-filter-opt mbk-reset"
        data-filter="all"
        onClick={() => onView?.("all")}
        type="button"
      >
        All
      </button>
      <button
        aria-pressed={filter.view === "changes"}
        className="mbk-nav-filter-opt mbk-reset"
        data-filter="changed"
        onClick={() => onView?.("changes")}
        type="button"
      >
        Changes
        <span className="mbk-nav-filter-count mbk-reset">
          {status === "ready" ? (
            filter.count
          ) : status === "unavailable" ? (
            <span aria-label="Changes unavailable" className="mbk-reset">
              —
            </span>
          ) : (
            <span
              className="mbk-nav-spinner mbk-reset"
              role="status"
              aria-label={CHANGES_MESSAGES[status].spinner}
            />
          )}
        </span>
      </button>
    </div>
  );
}

/**
 * The status line. While detection works it shows a spinner, and the
 * preparing state adds a detail line below its title.
 */
export function StatusLine({ status }: { status: NavigationStatus }) {
  const { message } = status;
  const preparing = message === "preparing";
  return (
    <div
      className="mbk-nav-status mbk-reset"
      data-nav-status=""
      hidden={status.hidden}
      role="status"
    >
      {preparing || message === "pending" ? (
        <span className="mbk-nav-spinner mbk-reset" aria-hidden="true" />
      ) : null}
      <span
        data-nav-status-text=""
        className={preparing ? "mbk-nav-status-text mbk-reset" : "mbk-reset"}
      >
        {preparing ? (
          <>
            <span className="mbk-nav-status-title mbk-reset">
              {CHANGES_MESSAGES.preparing.title}
            </span>
            <span className="mbk-nav-status-detail mbk-reset">
              {CHANGES_MESSAGES.preparing.detail}
            </span>
          </>
        ) : (
          STATUS_TEXT[message]
        )}
      </span>
    </div>
  );
}
