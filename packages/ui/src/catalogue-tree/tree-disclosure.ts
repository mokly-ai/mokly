/** The disclosure behaviour that sections and folders share. */

import type { MouseEvent, SyntheticEvent } from "react";

import type { NavigationDisclosure } from "./tree-records.js";

/** How the tree reports the reader's disclosure choices. */
export interface DisclosureActions {
  /**
   * Whether summaries report their choices. A tree that is not interactive
   * leaves each `<details>` to its native behaviour.
   */
  interactive: boolean;
  /** Receives a disclosure key and the open state that the reader chose. */
  onDisclosure: ((disclosure: string, open: boolean) => void) | undefined;
}

/** `data-filter-open`: the open state from before filtering, while it applies. */
export function filterMark(
  filterOpen: boolean | undefined,
): string | undefined {
  if (filterOpen === undefined) return undefined;
  return filterOpen ? "1" : "0";
}

/**
 * The handlers of a section or folder disclosure. An interactive summary
 * click reports the new state at once and stops the native toggle, so the
 * choice is recorded before a queued toggle event or a later filter input.
 * A toggle event that disagrees with the shown state reports the new state.
 */
export function disclosureHandlers(
  actions: DisclosureActions,
  { disclosure, open }: NavigationDisclosure,
) {
  return {
    onSummaryClick(event: MouseEvent<HTMLElement>) {
      if (!actions.interactive) return;
      event.preventDefault();
      actions.onDisclosure?.(disclosure, !open);
    },
    onToggle(event: SyntheticEvent<HTMLDetailsElement>) {
      if (actions.interactive && event.currentTarget.open !== open)
        actions.onDisclosure?.(disclosure, event.currentTarget.open);
    },
  };
}
