/**
 * Changes loading in Serve keeps the navigation layout and the Changes
 * selection through pending, ready with changes, ready with none, and
 * unavailable states. The incomplete states are emulated on real watched
 * publications; the ready states are Serve's own classification.
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

for (const mobile of [false, true]) {
  test(`Changes loading preserves navigation layout and selection (${mobile ? "mobile" : "desktop"})`, async ({
    page,
    changes,
  }) => {
    // At the head commit Changes is empty until a watched edit.
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
      mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    );
    await page.goto(`/view/${changes.paths.changed}/`);
    await page
      .locator("html")
      .evaluate((root) => root.setAttribute("data-test-retained", "true"));
    if (mobile) await page.locator("[data-mokly-menu]").click();
    const all = page.locator('[data-filter="all"]');
    const changesFilter = page.locator('[data-filter="changed"]');
    const filter = page.locator("[data-mokly-filter]");
    const tree = page.locator("[data-mokly-nav-scroll]");
    const status = page.locator("[data-nav-status]");
    await expect(all).toBeVisible();
    await expect(changesFilter).toBeVisible();
    await expect(changesFilter.locator(".mbk-nav-spinner")).toBeVisible();
    await expect(navRow(page, changes.paths.changed)).toBeVisible();
    const initialFilter = await filter.boundingBox();
    const initialTree = await tree.boundingBox();
    await changesFilter.click();
    await expect(status).toBeVisible();
    await expect(status).toContainText("Checking for changes");
    await expect(page.locator("a[data-nav-row]:visible")).toHaveCount(0);
    await all.click();
    await expect(status).toBeHidden();
    await changesFilter.click();

    emulation.set(undefined);
    await publish("Consumer renamed");
    await expect(filter).toHaveAttribute("data-changes-status", "ready");
    await expect(changesFilter).toHaveAttribute("aria-pressed", "true");
    await expect(changesFilter.locator(".mbk-nav-filter-count")).toHaveText(
      "1",
    );
    await expect(navRow(page, changes.paths.consumer)).toBeVisible();
    await expect(status).toBeHidden();
    expect(await filter.boundingBox()).toEqual(initialFilter);
    expect(await tree.boundingBox()).toEqual(initialTree);

    emulation.set("pending");
    await publish("Consumer checked");
    await expect(status).toContainText("Checking for changes");
    await expect(changesFilter).toHaveAttribute("aria-pressed", "true");
    emulation.set(undefined);
    await publish("Consumer screen");
    await expect(changesFilter.locator(".mbk-nav-filter-count")).toHaveText(
      "0",
    );
    await expect(changesFilter).toHaveAttribute("aria-pressed", "true");
    await expect(status).toContainText("No changes found");
    expect(await filter.boundingBox()).toEqual(initialFilter);

    emulation.set("pending");
    await publish("Consumer renamed");
    await expect(filter).toHaveAttribute("data-changes-status", "pending");
    emulation.set("unavailable");
    await publish("Consumer screen");
    await expect(status).toContainText("Changes are unavailable");
    await expect(page.locator(".mbk-nav-spinner")).toHaveCount(0);
    await all.click();
    await expect(status).toBeHidden();
    await expect(navRow(page, changes.paths.changed)).toBeVisible();
    expect(await filter.boundingBox()).toEqual(initialFilter);
    await page.emulateMedia({ reducedMotion: "reduce" });
    emulation.set("pending");
    await publish("Consumer renamed");
    await expect(changesFilter.locator(".mbk-nav-spinner")).toHaveCSS(
      "animation-name",
      "none",
    );
    await changesFilter.focus();
    await expect(changesFilter).toBeFocused();
    await page.keyboard.press("Space");
    await expect(status).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-test-retained",
      "true",
    );
  });
}
