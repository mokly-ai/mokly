/** The keys of the inspector's tab strip, which move focus between the tabs. */

import type { KeyboardEvent } from "react";

/** The keys that move focus between the tabs. */
const TAB_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * Move focus to the tab that a key names: the arrow keys step and wrap
 * around, and Home and End choose the first and the last tab.
 */
export function onTabKeyDown(
  event: KeyboardEvent<HTMLElement>,
  count: number,
): void {
  const target = event.target;
  if (
    !(target instanceof HTMLElement) ||
    !target.matches("[data-inspector-tab]") ||
    !TAB_KEYS.has(event.key)
  )
    return;
  event.preventDefault();
  const tabs = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      "[data-inspector-tab]",
    ),
  ];
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? count - 1
        : (tabs.indexOf(target) +
            (event.key === "ArrowRight" ? 1 : count - 1)) %
          count;
  tabs[next]?.focus();
}
