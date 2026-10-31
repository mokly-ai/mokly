/**
 * The All and Changes filter above the tree and the status line at its top.
 * They tell a detection that still runs, or that failed, from a real empty
 * result.
 */

import type { ReactNode } from "react";

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

/** The view that a filter shows, and the `data-filter` value that names it. */
const FILTER_NAMES = { all: "all", changes: "changed" } as const;

/**
 * One filter. A filter with an address is a link. A filter without one is a
 * toggle button that reports its view, or text when the column is not
 * operable. A link or text names the shown filter as the current page,
 * because each filter of a static depiction is its own page.
 */
function FilterOption({
  children,
  href,
  onView,
  operable,
  shown,
  view,
}: {
  children: ReactNode;
  href: string | undefined;
  onView: ((view: "all" | "changes") => void) | undefined;
  operable: boolean;
  shown: boolean;
  view: "all" | "changes";
}) {
  const depicted = {
    "aria-current": shown ? ("page" as const) : undefined,
    className: shown ? "mbk-nav-filter-opt active" : "mbk-nav-filter-opt",
    "data-filter": FILTER_NAMES[view],
  };
  if (href !== undefined)
    return (
      <a {...depicted} href={href}>
        {children}
      </a>
    );
  if (!operable) return <span {...depicted}>{children}</span>;
  return (
    <button
      aria-pressed={shown}
      className="mbk-nav-filter-opt"
      data-filter={FILTER_NAMES[view]}
      onClick={() => onView?.(view)}
      type="button"
    >
      {children}
    </button>
  );
}

/**
 * The filter group. The count slot holds the number of changed entries once
 * detection is ready, a dash when it failed, and otherwise a spinner whose
 * status names the work that runs.
 */
export function FilterGroup({
  filter,
  href,
  onView,
  operable,
}: {
  filter: NavigationFilter;
  href: ((view: "all" | "changes") => string | undefined) | undefined;
  onView: ((view: "all" | "changes") => void) | undefined;
  operable: boolean;
}) {
  const { status } = filter;
  return (
    <div
      aria-label="Catalogue filter"
      className="mbk-nav-filter"
      data-mokly-filter=""
      data-changes-status={status}
      role="group"
    >
      <FilterOption
        href={href?.("all")}
        onView={onView}
        operable={operable}
        shown={filter.view === "all"}
        view="all"
      >
        All
      </FilterOption>
      <FilterOption
        href={href?.("changes")}
        onView={onView}
        operable={operable}
        shown={filter.view === "changes"}
        view="changes"
      >
        Changes
        <span className="mbk-nav-filter-count">
          {status === "ready" ? (
            filter.count
          ) : status === "unavailable" ? (
            <span aria-label="Changes unavailable">—</span>
          ) : (
            <span
              className="mbk-nav-spinner"
              role="status"
              aria-label={CHANGES_MESSAGES[status].spinner}
            />
          )}
        </span>
      </FilterOption>
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
      className="mbk-nav-status"
      data-nav-status=""
      hidden={status.hidden}
      role="status"
    >
      {preparing || message === "pending" ? (
        <span className="mbk-nav-spinner" aria-hidden="true" />
      ) : null}
      <span
        data-nav-status-text=""
        className={preparing ? "mbk-nav-status-text" : undefined}
      >
        {preparing ? (
          <>
            <span className="mbk-nav-status-title">
              {CHANGES_MESSAGES.preparing.title}
            </span>
            <span className="mbk-nav-status-detail">
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
