/**
 * The catalogue filter and status records. They tell unknown evidence from a
 * real empty result.
 */

import type {
  NavigationFilter,
  NavigationStatus,
} from "@mokly/ui/catalogue-navigation";
import type { NavigationSection } from "@mokly/ui/catalogue-tree";

import type { NavigationContext } from "./context.js";
import type { NavigationSelection } from "./nav_model.js";
import { queryConstrains } from "./search_query.js";

/** The All and Changes filter, or nothing for a catalogue without Changes. */
export function navFilter(
  context: NavigationContext,
  view: NavigationSelection["view"],
): NavigationFilter | undefined {
  const status = context.changedEntries ? "ready" : context.changesStatus;
  if (!status) return undefined;
  return {
    count: context.changedEntries?.length,
    status,
    view,
  };
}

/**
 * The status line under Changes, or nothing for a catalogue without Changes.
 * It shows while detection works or failed, and when the filters keep no row.
 */
export function navStatus(
  context: NavigationContext,
  selection: NavigationSelection,
  sections: readonly NavigationSection[],
): NavigationStatus | undefined {
  if (!context.changesStatus && !context.changedEntries) return undefined;
  const status = context.changedEntries ? undefined : context.changesStatus;
  const selected = selection.view === "changes";
  const visible = sections.some((section) => !section.hidden);
  const constrained = queryConstrains({
    freeText: selection.search,
    tags: selection.tags,
  });
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
