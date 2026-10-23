/**
 * Preparing a comparison in Serve keeps All usable and the catalogue layout
 * fixed. Preparing, pending, and unavailable are emulated on real watched
 * publications; the ready state is Serve's own classification.
 */

import { expect } from "@playwright/test";

import { navRow } from "./comparison_ui.js";
import {
  consumerSource,
  consumerTitled,
  CONSUMER_SOURCE,
  emulateChangesStatus,
} from "./serve_changes_emulation.js";
import { test } from "./serve_comparison_test.js";

const DETAIL =
  "This takes a moment. You can keep browsing All while it finishes.";

for (const mobile of [false, true]) {
  test(`Preparing a comparison keeps All usable and the layout fixed (${mobile ? "mobile" : "desktop"})`, async ({
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
    emulation.set("preparing");
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    );
    await page.goto(`/view/${changes.paths.changed}/`);
    if (mobile) await page.locator("[data-mokly-menu]").click();
    const all = page.locator('[data-filter="all"]');
    const changesFilter = page.locator('[data-filter="changed"]');
    const filter = page.locator("[data-mokly-filter]");
    const tree = page.locator("[data-mokly-nav-scroll]");
    const status = page.locator("[data-nav-status]");
    const search = page.locator("[data-mokly-search]");
    await expect(
      changesFilter.locator(".mbk-nav-spinner"),
    ).toHaveAccessibleName("Preparing comparison");
    await expect(navRow(page, changes.paths.changed)).toBeVisible();
    const initialFilter = await filter.boundingBox();
    const initialTree = await tree.boundingBox();

    await changesFilter.click();
    await expect(status).toBeVisible();
    await expect(status.locator(".mbk-nav-status-title")).toHaveText(
      "Preparing comparison",
    );
    await expect(status.locator(".mbk-nav-status-detail")).toHaveText(DETAIL);
    await expect(tree).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("a[data-nav-row]:visible")).toHaveCount(0);
    await all.click();
    await expect(status).toBeHidden();
    await expect(navRow(page, changes.paths.changed)).toBeVisible();
    expect(await filter.boundingBox()).toEqual(initialFilter);
    expect(await tree.boundingBox()).toEqual(initialTree);

    await changesFilter.click();
    emulation.set("pending");
    await publish("Consumer checked");
    await expect(filter).toHaveAttribute("data-changes-status", "pending");
    await expect(status).toContainText("Checking for changes");
    await expect(status.locator(".mbk-nav-status-detail")).toHaveCount(0);
    await expect(changesFilter).toHaveAttribute("aria-pressed", "true");

    emulation.set(undefined);
    await publish("Consumer renamed");
    await expect(changesFilter.locator(".mbk-nav-filter-count")).toHaveText(
      "1",
    );
    await expect(status).toBeHidden();

    await search.fill("Consumer");
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    emulation.set("preparing");
    await publish("Consumer prepared");
    await expect(filter).toHaveAttribute("data-changes-status", "preparing");
    await expect(status.locator(".mbk-nav-status-title")).toHaveText(
      "Preparing comparison",
    );
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("Consumer");
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
    expect(await filter.boundingBox()).toEqual(initialFilter);

    emulation.set("unavailable");
    await publish("Consumer screen");
    await expect(status).toContainText("Changes are unavailable");
    await expect(page.locator(".mbk-nav-spinner")).toHaveCount(0);
    await expect(status.locator(".mbk-nav-status-detail")).toHaveCount(0);
    await expect(changesFilter.locator(".mbk-nav-filter-count")).toHaveText(
      "—",
    );
    await all.click();
    await expect(status).toBeHidden();
    expect(await filter.boundingBox()).toEqual(initialFilter);
    expect(await tree.boundingBox()).toEqual(initialTree);

    await page.emulateMedia({ reducedMotion: "reduce" });
    emulation.set("preparing");
    await publish("Consumer renamed");
    await expect(changesFilter.locator(".mbk-nav-spinner")).toHaveCSS(
      "animation-name",
      "none",
    );
  });
}
