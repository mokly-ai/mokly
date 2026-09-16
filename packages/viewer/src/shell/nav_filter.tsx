/** Stable catalogue controls distinguish unknown evidence from a real empty result. */
import type { ShellContext } from "./context.js";

/**
 * Copy for the two states that are still working. `spinner` labels the count
 * slot; only `preparing` adds the secondary detail line beneath its title.
 */
const CHANGES_MESSAGES = {
  pending: { title: "Checking for changes…", spinner: "Checking for changes" },
  preparing: {
    title: "Preparing comparison",
    spinner: "Preparing comparison",
    detail: "This takes a moment. You can keep browsing All while it finishes.",
  },
} as const;

export function NavFilter({ context }: { context: ShellContext }) {
  const status = context.changedRoutes ? "ready" : context.changesStatus;
  if (!status) return null;
  return (
    <div
      aria-label="Catalogue filter"
      className="mbk-nav-filter"
      data-mokly-filter=""
      data-changes-status={status}
      role="group"
    >
      <button
        aria-pressed="true"
        className="mbk-nav-filter-opt"
        data-filter="all"
        type="button"
      >
        All
      </button>
      <button
        aria-pressed="false"
        className="mbk-nav-filter-opt"
        data-filter="changed"
        type="button"
      >
        Changes
        <span className="mbk-nav-filter-count">
          {status === "ready" ? (
            context.changedRoutes?.length
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
      </button>
    </div>
  );
}

export function NavStatus({ context }: { context: ShellContext }) {
  if (!context.changesStatus && !context.changedRoutes) return null;
  const status = context.changedRoutes ? undefined : context.changesStatus;
  const preparing = status === "preparing";
  return (
    <div className="mbk-nav-status" data-nav-status="" hidden role="status">
      {preparing || status === "pending" ? (
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
        ) : context.changedRoutes ? (
          "No changes found."
        ) : status === "pending" ? (
          CHANGES_MESSAGES.pending.title
        ) : (
          "Changes are unavailable. You can still browse All."
        )}
      </span>
    </div>
  );
}
