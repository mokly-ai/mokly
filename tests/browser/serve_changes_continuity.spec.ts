/**
 * Background evidence in Serve preserves All: the arranged navigation,
 * focus, the mounted documents, and the row elements survive pending,
 * preparing, ready, and unavailable publications. Incomplete states are
 * emulated on real watched publications of the Consumer title.
 */

import { expect } from "@playwright/test";

import {
  consumerSource,
  consumerTitled,
  CONSUMER_SOURCE,
  emulateChangesStatus,
  navigationState,
} from "./serve_changes_emulation.js";
import { test } from "./serve_comparison_test.js";

for (const mobile of [false, true]) {
  test(`background evidence preserves All without replacing documents (${mobile ? "mobile" : "desktop"})`, async ({
    page,
    changes,
  }) => {
    await changes.moveBase("head");
    const publish = (title: string) =>
      changes.edit(
        CONSUMER_SOURCE,
        consumerSource(title),
        consumerTitled(title),
      );
    const emulation = await emulateChangesStatus(page);
    emulation.set("pending");
    await page.setViewportSize(
      mobile ? { width: 390, height: 500 } : { width: 1280, height: 500 },
    );
    await page.goto(`/view/${changes.paths.changed}/`);
    const frame = page.frameLocator(".mbk-frame-mobile iframe");
    await expect(frame.locator("h1")).toHaveText("After screen");
    await frame
      .locator("body")
      .evaluate((body) => body.setAttribute("data-test-retained", "true"));
    if (mobile) await page.locator("[data-mokly-menu]").click();
    // Open two nested folders and close the current entry's own folder: an
    // update must neither reveal the route nor restore a default disclosure.
    for (const folder of [
      "specs:branch/consumers",
      "specs:branch/moves",
      "components:branch/moves",
      "specs:screens",
    ])
      await page
        .locator(`[data-nav-disclosure="folder:${folder}"] > summary`)
        .click();
    const tree = page.locator("[data-mokly-nav-scroll]");
    expect(
      await tree.evaluate(
        (node) => node.scrollHeight > node.clientHeight + 120,
      ),
    ).toBe(true);
    await tree.evaluate((node) => {
      node.scrollTop = 120;
    });
    await page.locator('[data-filter="all"]').focus();
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    const originalRows = await page.locator(".mbk-nav-row").elementHandles();
    const before = await navigationState(page);
    const consumer = page.locator(
      'a[data-nav-row][data-route="screens/consumer/index.html"]',
    );

    await publish("Consumer pending");
    await expect(consumer).toContainText("Consumer pending");
    expect(await navigationState(page)).toEqual(before);
    emulation.set("preparing");
    await publish("Consumer preparing");
    await expect(page.locator("[data-changes-status]")).toHaveAttribute(
      "data-changes-status",
      "preparing",
    );
    expect(await navigationState(page)).toEqual(before);
    await expect(page.locator('[data-filter="all"]')).toBeFocused();
    emulation.set(undefined);
    await publish("Consumer renamed");
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("1");
    expect(await navigationState(page)).toEqual(before);
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    await expect(frame.locator("body")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    for (const row of originalRows)
      expect(await row.evaluate((node) => node.isConnected)).toBe(true);

    await page.locator("[data-mokly-search]").fill("Consumer");
    const searched = await navigationState(page);
    await publish("Consumer screen");
    await expect(page.locator(".mbk-nav-filter-count")).toHaveText("0");
    expect(await navigationState(page)).toEqual(searched);
    await expect(page.locator("[data-mokly-search]")).toBeFocused();
    await expect(page.locator("[data-workspace-status]")).toHaveText(
      "Unmodified",
    );
    emulation.set("unavailable");
    await publish("Consumer renamed");
    await expect(page.locator("[data-changes-status]")).toHaveAttribute(
      "data-changes-status",
      "unavailable",
    );
    await expect(page.locator("[data-workspace-status]")).toBeHidden();
    expect(await navigationState(page)).toEqual(searched);
  });
}
