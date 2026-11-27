/**
 * A level 2 heading of the main region in a browser spec, found by its role
 * and its exact name, never by its position. Inspect's head names the routed
 * entry with a level 2 heading, and a stage state, such as a failure, can
 * render its own level 2 heading before it, so the first heading of the
 * region depends on the order in which the two render.
 */

import type { Locator, Page } from "@playwright/test";

/**
 * The level 2 heading of `#mb-main` whose accessible name is `name`. Pass
 * `includeHidden` to also find a heading that is mounted but hidden, such as
 * Inspect's title while the Changes tab is selected.
 */
export function mainHeading(
  page: Page,
  name: string,
  { includeHidden = false }: { includeHidden?: boolean } = {},
): Locator {
  return page
    .locator("#mb-main")
    .getByRole("heading", { level: 2, name, exact: true, includeHidden });
}
