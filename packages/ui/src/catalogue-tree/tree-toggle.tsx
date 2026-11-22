/** The toggle that discloses an entry's list, or the picture of the toggle. */

import { ChevronIcon } from "../icons/icons.js";

import type { DisclosureActions } from "./tree-disclosure.js";
import type { NavigationList } from "./tree-records.js";

/**
 * The toggle of an entry's list: a button that reports the list's new state
 * through `onDisclosure`, also where the summaries are native. A tree that is
 * not interactive and has no callback runs no script, so it draws a picture of
 * the toggle, which carries the picture marker. A picture has no expanded
 * state, so its name says whether it would show or hide the list, and
 * `data-nav-variants-open` turns its chevron while the list is open.
 */
export function ListToggle({
  actions,
  list,
}: {
  actions: DisclosureActions;
  list: NavigationList;
}) {
  const noun = list.rows.length > 0 ? "contents" : "variants";
  const name = `${list.open ? "Hide" : "Show"} ${noun} of ${list.title}`;
  if (!actions.interactive && actions.onDisclosure === undefined)
    return (
      <span
        aria-label={name}
        className="mbk-nav-variants-toggle mbk-picture mbk-reset"
        data-nav-variants-label={list.title}
        data-nav-variants-noun={noun}
        data-nav-variants-open={list.open ? "" : undefined}
        data-nav-variants-toggle={list.id}
        role="img"
      >
        <ChevronIcon size={16} />
      </span>
    );
  return (
    <button
      aria-controls={list.id}
      aria-expanded={list.open ? "true" : "false"}
      aria-label={name}
      className="mbk-nav-variants-toggle mbk-reset"
      data-nav-variants-label={list.title}
      data-nav-variants-noun={noun}
      data-nav-variants-toggle={list.id}
      onClick={() => actions.onDisclosure?.(list.disclosure, !list.open)}
      type="button"
    >
      <ChevronIcon size={16} />
    </button>
  );
}
