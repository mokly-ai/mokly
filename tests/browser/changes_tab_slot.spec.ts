/**
 * The host's `changesStart` slot in an embedded viewer over the copied
 * comparison output. The host's content shows in the Changes tab after the
 * change stepper and before Compared, and a link in it stays the host's: the
 * shell does not route it, so the browser follows it. A host component that
 * renders nothing leaves the tab as it is without the slot.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { changesSlotHost, type ChangesSlotHost } from "./changes_slot_host.js";
import { changeCount, changesPanel, comparedRail } from "./changes_tab_ui.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { openPanelTab } from "./panel_actions.js";

let host: ChangesSlotHost;

test.beforeAll(async () => {
  host = await changesSlotHost();
});

test.afterAll(async () => {
  await host?.close();
});

/**
 * The address of a catalogue page, which the host's link names: the shell
 * routes in place a link of its own that names such a page.
 */
const HOST_LINK = `/view/${comparisonPaths.unchanged}/`;

/** Open the changed screen's Changes tab with the host's `slot` content. */
async function openChanges(page: Page, slot?: "empty" | "link") {
  const query = new URLSearchParams({ entry: comparisonPaths.changed });
  if (slot) query.set("slot", slot);
  if (slot === "link") query.set("link", HOST_LINK);
  await page.goto(`${host.url}/viewer.html?${query}`);
  await openPanelTab(page, "Changes");
  await expect(changeCount(page)).toBeVisible();
  await expect(comparedRail(page)).toBeVisible();
}

/** The top and the bottom edge of an element, in page pixels. */
async function edges(
  locator: Locator,
): Promise<{ top: number; bottom: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box");
  return { top: box.y, bottom: box.y + box.height };
}

test("the host's content shows after the stepper and before Compared, and its link stays the host's", async ({
  page,
}) => {
  await openChanges(page, "link");
  const content = changesPanel(page).getByText(/^Host check passed\./u);
  await expect(content).toBeVisible();
  const stepper = await edges(changeCount(page));
  const slot = await edges(content);
  const compared = await edges(comparedRail(page));
  expect(stepper.bottom).toBeLessThanOrEqual(slot.top);
  expect(slot.bottom).toBeLessThanOrEqual(compared.top);

  // The shell leaves the host's link alone, so the browser loads its page.
  await changesPanel(page)
    .getByRole("link", { name: "Open the host page" })
    .click();
  await expect(page).toHaveURL(`${host.url}${HOST_LINK}`);
});

test("a host component that renders nothing takes no space between the stepper and Compared", async ({
  page,
}) => {
  // A host that gives no slot draws no container; Compared then follows the
  // stepper directly.
  await openChanges(page);
  const without = await edges(comparedRail(page));
  await openChanges(page, "empty");
  expect((await edges(comparedRail(page))).top).toBe(without.top);
});
