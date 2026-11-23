/**
 * Props delivery on the example Serve host, under the component controls
 * contract: until the routed entry's detail arrives, Props shows
 * `Loading props…` and no fields, so the fields first appear in the detail's
 * declared order and never move. A failed detail offers Try again.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { chooseRow } from "./live_props.js";
import { networkFailure } from "./shell_error_allowances.js";
import { openInspectFold } from "./workspace_actions.js";

const ORIGIN = "design/library/canvas/selection";
/** Its index lists `presentation, zoom`; its detail declares `zoom, presentation`. */
const DESTINATION = "design/library/canvas/zoom-pill";
const DECLARED = ["zoom", "presentation"];

/**
 * The routed entry's title in Inspect's head. The panel follows the canvas,
 * so a failure card's own heading on the canvas comes first.
 */
function title(page: Page) {
  return page.locator('#mb-main [data-inspect-section="details"] h2');
}

/** Hold the first read of the destination's detail; later reads continue. */
async function holdDetail(page: Page, fail = false) {
  const held: Route[] = [];
  await page.route(`**/mokly-viewer/entries/${DESTINATION}.json`, (route) => {
    if (held.length) return route.continue();
    held.push(route);
    if (fail) return route.abort();
  });
  return held;
}

/** Open Props on the origin, then move to the destination in the page. */
async function openDestination(page: Page) {
  await page.goto(`/view/${ORIGIN}/`);
  await expect(title(page)).toHaveText("Selection");
  await openInspectFold(page, "props");
  // Record the order of every field list that the panel ever shows.
  await page.evaluate(() => {
    const orders: string[] = [];
    Object.assign(window, { fieldOrders: orders });
    new MutationObserver(() => {
      const names = [...document.querySelectorAll("[data-prop-control]")].map(
        (field) => field.getAttribute("data-prop-control"),
      );
      if (names.length) orders.push(names.join(","));
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function moveToDestination(page: Page) {
  await page
    .locator(
      `nav.mbk-nav a[data-nav-row][data-route="${DESTINATION}/index.html"]`,
    )
    .click();
  await expect(title(page)).toHaveText("Zoom pill");
  // Props edits the row of the selected frame: the component's own row.
  await chooseRow(page, DESTINATION);
  return openInspectFold(page, "props");
}

function fieldOrders(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { fieldOrders: string[] }).fieldOrders,
  );
}

test("Props wait for the routed detail, then show the fields once in their declared order", async ({
  page,
}) => {
  await openDestination(page);
  const held = await holdDetail(page);
  const props = await moveToDestination(page);
  await expect.poll(() => held.length).toBe(1);
  await expect(props).toHaveText("Loading props…");
  await expect(props.locator("[data-prop-control]")).toHaveCount(0);

  await held[0]!.continue();
  const fields = props.locator("[data-prop-control]");
  await expect(fields).toHaveCount(DECLARED.length);
  expect(
    await fields.evaluateAll((all) =>
      all.map((field) => field.getAttribute("data-prop-control")),
    ),
  ).toEqual(DECLARED);
  // The destination's fields never showed the index's order.
  expect(
    (await fieldOrders(page)).filter((order) => order === "presentation,zoom"),
  ).toEqual([]);
});

test("a failed detail offers Try again in Props, and the fields arrive with the retried detail", async ({
  allowBrowserError,
  baseURL,
  page,
}) => {
  // The aborted read is the failure under test.
  allowBrowserError(
    networkFailure(baseURL!, `/mokly-viewer/entries/${DESTINATION}.json`),
  );
  await openDestination(page);
  await holdDetail(page, true);
  const props = await moveToDestination(page);
  await expect(props.getByRole("alert")).toHaveText(
    "Props couldn’t be loaded.",
  );
  await expect(props.locator("[data-prop-control]")).toHaveCount(0);

  await props.getByRole("button", { name: "Try again", exact: true }).click();
  const fields = props.locator("[data-prop-control]");
  await expect(fields).toHaveCount(DECLARED.length);
  expect(
    await fields.evaluateAll((all) =>
      all.map((field) => field.getAttribute("data-prop-control")),
    ),
  ).toEqual(DECLARED);
});
