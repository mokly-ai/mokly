/**
 * Inspect's head in a browser spec: the routed entry's title and the change
 * status beside it. The right panel keeps Inspect mounted in either layout,
 * also while its Changes tab is selected, so a check of the text needs no
 * tab; a check of the layout first shows Inspect.
 */

import type { Locator, Page } from "@playwright/test";

/**
 * The head of Inspect, the section named `Details`: the title, the status,
 * the description and the Details rows.
 */
export function inspectHead(scope: Page | Locator): Locator {
  return scope.locator('[data-inspect-section="details"]');
}

/** The routed entry's title in Inspect's head. */
export function inspectTitle(scope: Page | Locator): Locator {
  return inspectHead(scope).locator("h2");
}

/** The change status beside the title in Inspect's head, such as `Changed`. */
export function inspectStatus(scope: Page | Locator): Locator {
  return inspectHead(scope).locator(".mbk-entry-status");
}
