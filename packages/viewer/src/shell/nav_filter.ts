/**
 * The catalogue filter and status records. They tell unknown evidence from a
 * real empty result.
 */

import type {
  NavigationFilter,
  NavigationStatus,
} from "@mokly/ui/catalogue-navigation";

import type { ShellContext } from "./context.js";
import { navNodeVisible } from "./nav_model.js";
import { queryConstrains } from "./search_query.js";
import type { ShellStore } from "./store_context.js";

/** The All and Changes filter, or nothing for a catalogue without Changes. */
export function navFilter(
  context: ShellContext,
  store: Pick<ShellStore, "state"> | undefined,
): NavigationFilter | undefined {
  const status = context.changedEntries ? "ready" : context.changesStatus;
  if (!status) return undefined;
  return {
    count: context.changedEntries?.length,
    status,
    view: store?.state.selection.view ?? "all",
  };
}

/**
 * The status line under Changes, or nothing for a catalogue without Changes.
 * It shows while detection works or failed, and when the filters keep no row.
 */
export function navStatus(
  context: ShellContext,
  store: Pick<ShellStore, "context" | "sections" | "state"> | undefined,
): NavigationStatus | undefined {
  if (!context.changesStatus && !context.changedEntries) return undefined;
  const status = context.changedEntries ? undefined : context.changesStatus;
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
  return {
    hidden: !selected || (status === undefined && visible),
    message:
      status === "preparing"
        ? "preparing"
        : context.changedEntries
          ? constrained
            ? "unmatched"
            : "none"
          : status === "pending"
            ? "pending"
            : "unavailable",
  };
}
