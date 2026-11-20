/**
 * Focus after Try again on the example Serve host, under the recovery focus
 * rule of the viewer protocol: the pressed button leaves, so focus moves to
 * the status that replaces it, and then to the content that replaces the
 * status. The routed detail fails once, and the retried read waits until the
 * test lets it through.
 */

import { expect, type Locator, type Page, type Route } from "@playwright/test";

import { test } from "./browser_test.js";
import { networkFailure } from "./shell_error_allowances.js";

const ENTRY = "design/library/chrome/screen-header";
const DETAIL = `/mokly-viewer/entries/${ENTRY}.json`;

/** Fail the first read of the entry's detail and hold the next one. */
async function failThenHold(page: Page): Promise<Route[]> {
  const held: Route[] = [];
  let reads = 0;
  await page.route(`**${DETAIL}`, (route) => {
    reads += 1;
    if (reads === 1) return route.abort();
    held.push(route);
  });
  return held;
}

/** Open the entry with its first detail read failed and the next one held. */
async function openFailed(page: Page): Promise<Route[]> {
  await page.setViewportSize({ width: 1280, height: 900 });
  const held = await failThenHold(page);
  await page.goto(`/view/${ENTRY}/`);
  await expect(page.locator("#mb-main h2").first()).toHaveText("Screen header");
  return held;
}

/** Press Try again in `region`, and check the status that takes focus. */
async function retry(
  held: Route[],
  region: Locator,
  status: Locator,
): Promise<void> {
  await region.getByRole("button", { name: "Try again", exact: true }).click();
  await expect.poll(() => held.length).toBe(1);
  await expect(status).toBeFocused();
  await held[0]!.continue();
}

/** Select an inspector tab, and return its panel. */
async function panel(page: Page, name: string): Promise<Locator> {
  const tab = page.getByRole("tab", { name, exact: true });
  // A click on the selected icon would close the panel.
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  return page.getByRole("tabpanel", { name, exact: true });
}

test.beforeEach(({ allowBrowserError, baseURL }) => {
  // The aborted first read is the failure under test.
  allowBrowserError(networkFailure(baseURL!, DETAIL));
});

test("Try again on the stage focuses its loading state, then its first frame", async ({
  page,
}) => {
  const held = await openFailed(page);
  const stage = page
    .getByRole("alert")
    .filter({ hasText: "This component could not be shown" });
  await expect(stage).toBeVisible();
  await retry(
    held,
    stage,
    page.locator("[data-mokly-stage]").filter({ hasText: "Loading preview…" }),
  );
  await expect(page.locator("#mb-main iframe").first()).toBeFocused();
});

test("Try again in Props focuses Loading props, then the panel heading", async ({
  page,
}) => {
  const held = await openFailed(page);
  const props = await panel(page, "Props");
  await expect(props.getByRole("alert")).toHaveText(
    "Props couldn’t be loaded.",
  );
  await retry(held, props, props.getByRole("status"));
  await expect(
    props.getByRole("heading", { name: "Edit props", exact: true }),
  ).toBeFocused();
});

test("Try again in Usage focuses Loading usage, then the first section heading", async ({
  page,
}) => {
  const held = await openFailed(page);
  const usage = await panel(page, "Usage");
  await expect(usage.getByRole("alert")).toHaveText(
    "Usage couldn’t be loaded.",
  );
  await retry(held, usage, usage.getByRole("status"));
  await expect(
    usage.getByRole("heading", { name: "Used by", exact: true }),
  ).toBeFocused();
});
