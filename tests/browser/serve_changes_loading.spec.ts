/**
 * Changes loading in Serve keeps the navigation layout, All, and the Changes
 * selection through a pending first load, a preparing first load, pending,
 * ready with changes, ready with none, and unavailable states. The incomplete
 * states are emulated on real watched publications; the ready states are
 * Serve's own classification.
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

test("Changes loading and preparing keep the navigation layout, All, and the Changes selection (desktop)", async ({
  page,
  changes,
}) => {
  // At the head commit Changes is empty until a watched edit.
  await changes.moveBase("head");
  const publish = (title: string) =>
    changes.edit(CONSUMER_SOURCE, consumerSource(title), consumerTitled(title));
  const emulation = await emulateChangesStatus(page);
  const all = page.locator('[data-filter="all"]');
  const changesFilter = page.locator('[data-filter="changed"]');
  const spinner = changesFilter.locator(".mbk-nav-spinner");
  const filter = page.locator("[data-mokly-filter]");
  const tree = page.locator("[data-mokly-nav-scroll]");
  const status = page.locator("[data-nav-status]");
  const search = page.locator("[data-mokly-search]");
  await page.setViewportSize({ width: 1280, height: 900 });

  // A first load while detection is pending.
  emulation.set("pending");
  await page.goto(`/view/${changes.paths.changed}/`);
  await expect(all).toBeVisible();
  await expect(spinner).toBeVisible();
  await expect(navRow(page, changes.paths.changed)).toBeVisible();
  await changesFilter.click();
  await expect(status).toBeVisible();
  await expect(status).toContainText("Checking for changes");
  await expect(page.locator("a[data-nav-row]:visible")).toHaveCount(0);
  await all.click();
  await expect(status).toBeHidden();

  emulation.set("preparing");
  await page.goto(`/view/${changes.paths.changed}/`);
  await page
    .locator("html")
    .evaluate((root) => root.setAttribute("data-test-retained", "true"));

  // The first load prepares the comparison.
  await expect(all).toBeVisible();
  await expect(changesFilter).toBeVisible();
  await expect(spinner).toHaveAccessibleName("Preparing comparison");
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

  // Detection is pending.
  emulation.set("pending");
  await publish("Consumer checked");
  await expect(filter).toHaveAttribute("data-changes-status", "pending");
  await expect(spinner).toBeVisible();
  await expect(status).toBeVisible();
  await expect(status).toContainText("Checking for changes");
  await expect(status.locator(".mbk-nav-status-detail")).toHaveCount(0);
  await expect(changesFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("a[data-nav-row]:visible")).toHaveCount(0);
  await all.click();
  await expect(status).toBeHidden();
  await changesFilter.click();

  // Ready with one change.
  emulation.set(undefined);
  await publish("Consumer renamed");
  await expect(filter).toHaveAttribute("data-changes-status", "ready");
  await expect(changesFilter).toHaveAttribute("aria-pressed", "true");
  await expect(changesFilter.locator(".mbk-nav-filter-count")).toHaveText("1");
  await expect(navRow(page, changes.paths.consumer)).toBeVisible();
  await expect(status).toBeHidden();
  expect(await filter.boundingBox()).toEqual(initialFilter);
  // The tree keeps its origin and width; in Changes the catalogue's foot,
  // which names the comparison base, takes the room below it.
  const shownTree = await tree.boundingBox();
  expect([shownTree?.x, shownTree?.y, shownTree?.width]).toEqual([
    initialTree?.x,
    initialTree?.y,
    initialTree?.width,
  ]);

  // Ready with no change.
  await publish("Consumer screen");
  await expect(changesFilter.locator(".mbk-nav-filter-count")).toHaveText("0");
  await expect(changesFilter).toHaveAttribute("aria-pressed", "true");
  await expect(status).toContainText("No changes found");
  expect(await filter.boundingBox()).toEqual(initialFilter);

  // Preparing again keeps the search, its focus, and the document. Reduced
  // motion stops the spinner of each state that works.
  await search.fill("Consumer");
  await page.emulateMedia({ reducedMotion: "reduce" });
  emulation.set("preparing");
  await publish("Consumer prepared");
  await expect(filter).toHaveAttribute("data-changes-status", "preparing");
  // A ready index that becomes incomplete keeps Changes selected.
  await expect(changesFilter).toHaveAttribute("aria-pressed", "true");
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
  await expect(spinner).toHaveCSS("animation-name", "none");

  // Unavailable.
  emulation.set("unavailable");
  await publish("Consumer screen");
  await expect(status).toContainText("Changes are unavailable");
  await expect(page.locator(".mbk-nav-spinner")).toHaveCount(0);
  await expect(status.locator(".mbk-nav-status-detail")).toHaveCount(0);
  await expect(changesFilter.locator(".mbk-nav-filter-count")).toHaveText("—");
  await expect(changesFilter).toHaveAttribute("aria-pressed", "true");
  await all.click();
  await expect(status).toBeHidden();
  expect(await filter.boundingBox()).toEqual(initialFilter);
  expect(await tree.boundingBox()).toEqual(initialTree);
  await search.fill("");
  await expect(navRow(page, changes.paths.changed)).toBeVisible();
  expect(await filter.boundingBox()).toEqual(initialFilter);

  // Pending again: the keyboard selects Changes, and the document stays.
  emulation.set("pending");
  await publish("Consumer renamed");
  await expect(spinner).toHaveCSS("animation-name", "none");
  await changesFilter.focus();
  await expect(changesFilter).toBeFocused();
  await page.keyboard.press("Space");
  await expect(status).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-test-retained",
    "true",
  );
});
