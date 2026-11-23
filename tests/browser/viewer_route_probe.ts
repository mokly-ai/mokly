/**
 * Route probes and selection reads of the viewer harness's root `one`: a
 * link inside the shell, as a host's or a document's own link is, and the
 * selection that the root last reported.
 */

import type { Page } from "@playwright/test";

import type { ViewerSelection } from "@mokly/viewer";

import type {} from "./viewer_harness.js";

/**
 * Add a link to `href` inside root `one`'s shell and follow it, by a click or,
 * with `keyboard`, by Enter on the focused link.
 */
export async function clickRouteProbe(
  page: Page,
  href: string,
  keyboard = false,
): Promise<void> {
  await page.evaluate((destination) => {
    document
      .querySelectorAll("#one [data-route-probe]")
      .forEach((element) => element.remove());
    const link = document.createElement("a");
    link.dataset.routeProbe = "";
    link.href = destination;
    link.textContent = "Route probe";
    document.querySelector("#one [data-mokly-shell]")?.append(link);
  }, href);
  const link = page.locator("#one [data-route-probe]");
  if (keyboard) {
    await link.focus();
    await page.keyboard.press("Enter");
  } else await link.click();
}

/** The selection of the last selection event that root `one` reported. */
export function lastSelection(
  page: Page,
): Promise<ViewerSelection | undefined> {
  return page.evaluate(
    () =>
      window.viewerHarness
        .get("one")
        .events.filter((event) => event.name === "selection")
        .at(-1)?.value as ViewerSelection | undefined,
  );
}
