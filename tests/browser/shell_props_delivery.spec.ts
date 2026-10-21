/**
 * Props delivery on the example Serve host, under the component controls
 * contract: until the routed entry's detail arrives, the Props tab shows
 * `Loading props…` and no fields, so the fields first appear in the detail's
 * declared order and never move. A failed detail offers Try again.
 */

import { expect, type Page, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { networkFailure } from "./shell_error_allowances.js";

const ORIGIN = "design/library/chrome/top-bar";
/** Its index lists `status, title`; its detail declares `title, status`. */
const DESTINATION = "design/library/chrome/screen-header";
const DECLARED = ["title", "status"];

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
  await expect(page.locator("#mb-main h2").first()).toHaveText("Top bar");
  const tab = page.getByRole("tab", { name: "Props", exact: true });
  // A click on the selected icon would close the panel.
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
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
  await expect(page.locator("#mb-main h2").first()).toHaveText("Screen header");
  return page.getByRole("tabpanel", { name: "Props", exact: true });
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
    (await fieldOrders(page)).filter((order) => order === "status,title"),
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
