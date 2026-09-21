/** Stable catalogue controls distinguish unknown evidence from a real empty result. */
import type { ShellContext } from "./context.js";
import { navNodeVisible } from "./nav_model.js";
import { queryConstrains } from "./search_query.js";
import { useOptionalShellStore } from "./store_context.js";

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
  const store = useOptionalShellStore();
  const status = context.changedRoutes ? "ready" : context.changesStatus;
  if (!status) return null;
  const selected = store?.state.selection.view ?? "all";
  return (
    <div
      aria-label="Catalogue filter"
      className="mbk-nav-filter"
      data-mokly-filter=""
      data-changes-status={status}
      role="group"
    >
      <button
        aria-pressed={selected === "all"}
        className="mbk-nav-filter-opt"
        data-filter="all"
        onClick={() => store?.setView("all")}
        type="button"
      >
        All
      </button>
      <button
        aria-pressed={selected === "changes"}
        className="mbk-nav-filter-opt"
        data-filter="changed"
        onClick={() => store?.setView("changes")}
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
  const store = useOptionalShellStore();
  if (!context.changesStatus && !context.changedRoutes) return null;
  const status = context.changedRoutes ? undefined : context.changesStatus;
  const preparing = status === "preparing";
  const selected = store?.state.selection.view === "changes";
  const visible =
    store?.sections.some((section) =>
      section.children.some((node) =>
        navNodeVisible(node, store.state.selection, store.context),
      ),
    ) ?? true;
  const constrained = store
    ? queryConstrains({
        freeText: store.state.selection.search,
        tags: store.state.selection.tags,
      })
    : false;
  return (
    <div
      className="mbk-nav-status"
      data-nav-status=""
      hidden={!selected || (status === undefined && visible)}
      role="status"
    >
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
          constrained ? (
            "No matching changes."
          ) : (
            "No changes found."
          )
        ) : status === "pending" ? (
          CHANGES_MESSAGES.pending.title
        ) : (
          "Changes are unavailable. You can still browse All."
        )}
      </span>
    </div>
  );
}
