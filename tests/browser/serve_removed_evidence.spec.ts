/**
 * Removed rows follow real background baselines in Serve: base moves add and
 * reconcile removed rows in place, a changed historical record replaces the
 * previous one rather than showing stale content, and a removed screen
 * variant joins its surviving parent's list.
 */

import { expect, type Page } from "@playwright/test";

import {
  addViewerStateSources,
  viewerStatePaths,
} from "../helpers/viewer_state_sources.js";

import { chooseFilter, navRow } from "./comparison_ui.js";
import {
  combinePublications,
  consumerSource,
  consumerTitled,
  CONSUMER_SOURCE,
  emulateChangesStatus,
} from "./serve_changes_emulation.js";
import { joinFixtureHistory } from "./serve_comparison_git.js";
import { test } from "./serve_comparison_test.js";

test.use({ comparisonSources: { add: addViewerStateSources } });

/** Requests for removed page preview metadata, in the order the page made them. */
function previewRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/previews/"))
      requests.push(request.url());
  });
  return requests;
}

/** One removed row, by entry path. */
const removedRow = (page: Page, entryPath: string) =>
  page.locator(`a[data-nav-removed][data-route="${entryPath}/index.html"]`);

test("background baselines reconcile removed rows and invalidate changed historical views", async ({
  page,
  changes,
}) => {
  const { removedScreen, removedPage, removedComponent } = changes.paths;
  // Two private bases: one before the component existed, and one where the
  // removed page had another title. Both join the history for base moves.
  const withoutComponent = await changes.commitBase({
    [`specs/${removedComponent}.component.html`]: null,
  });
  const retitled = await changes.commitBase({
    [`specs/${removedPage}.page.html`]:
      "---\ntitle: Earlier page\n---\n<!doctype html><html><head><title>Earlier page</title></head><body><h1>Earlier page</h1></body></html>",
  });
  for (const commit of [withoutComponent, retitled])
    await joinFixtureHistory(changes.root, commit);
  await changes.moveBase("head");
  const previews = previewRequests(page);
  const combined = await combinePublications(page);
  await page.goto(`/view/${changes.paths.changed}/`);
  const root = page.locator("html");
  await root.evaluate((element) =>
    element.setAttribute("data-test-retained", "true"),
  );
  const removed = page.locator("a[data-nav-removed]");
  await expect(removed).toHaveCount(0);

  await changes.moveBase(withoutComponent);
  await combined.release();
  await expect(removedRow(page, removedScreen)).toBeVisible();
  await expect(removedRow(page, removedPage)).toBeHidden();
  await expect(removedRow(page, removedComponent)).toHaveCount(0);
  const retained = await removedRow(page, removedScreen).elementHandle();
  const partial = await removed.count();

  await changes.moveBase("base");
  await combined.release();
  await expect(removed).toHaveCount(partial + 1);
  for (const [section, entryPath] of [
    ["specs", removedScreen],
    ["specs", removedPage],
    ["components", removedComponent],
  ])
    await expect(
      page.locator(
        `[data-nav-section="${section}"] a[data-nav-removed][data-route="${entryPath}/index.html"]`,
      ),
    ).toHaveCount(1);
  await expect(
    page.locator("[data-mokly-nav-scroll] > a[data-nav-removed]"),
  ).toHaveCount(0);
  // Flat removed rows follow the current tree in the server's order.
  const flat = (await changes.index()).removedEntries
    .filter(
      ({ entry }) =>
        entry.kind !== "component" &&
        !("variantOf" in entry && entry.variantOf !== undefined),
    )
    .map(({ entry }) => `${entry.path}/index.html`);
  expect(flat).toEqual(
    expect.arrayContaining([
      `${removedPage}/index.html`,
      `${removedScreen}/index.html`,
    ]),
  );
  expect(
    await page
      .locator(
        '[data-nav-section="specs"] a[data-nav-removed]:not([data-removed-variant])',
      )
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-route"))),
  ).toEqual(flat);
  expect(await retained!.evaluate((row) => row.isConnected)).toBe(true);
  await expect(removedRow(page, removedComponent)).toBeVisible();
  await expect(removedRow(page, removedPage)).toBeHidden();
  await expect(root).toHaveAttribute("data-test-retained", "true");

  await chooseFilter(page, "changed");
  await expect(removedRow(page, removedPage)).toBeVisible();
  expect(previews).toEqual([]);
  await removedRow(page, removedPage).click();
  await expect(
    page.getByRole("heading", { name: "Retired page", exact: true }),
  ).toBeVisible();
  await expect.poll(() => previews.length).toBeGreaterThan(0);
  const opened = page.url();
  const initialPreviews = previews.length;

  // The new base gives the page a new record; the old one is not kept.
  await changes.moveBase(retitled);
  await combined.release();
  await expect(
    page.getByRole("heading", { name: "Item not found", exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(opened);
  await expect(removedRow(page, removedPage)).toContainText(
    "Earlier page · Removed",
  );
  await removedRow(page, removedPage).click();
  await expect(
    page.getByRole("heading", { name: "Earlier page", exact: true }),
  ).toBeVisible();
  await expect.poll(() => previews.length).toBeGreaterThan(initialPreviews);
  await expect(root).toHaveAttribute("data-test-retained", "true");
  const settledPreviews = previews.length;

  await page.goto(`/view/${changes.paths.changed}/`);
  const emulation = await emulateChangesStatus(page);
  emulation.set("pending");
  await changes.edit(
    CONSUMER_SOURCE,
    consumerSource("Consumer renamed"),
    consumerTitled("Consumer renamed"),
  );
  await expect(removed).toHaveCount(0);
  expect(previews).toHaveLength(settledPreviews);
});

test("a background baseline places a removed variant under its parent", async ({
  page,
  changes,
}) => {
  const parent = viewerStatePaths.variantParent;
  const row = page.locator(
    `a[data-nav-row][data-route="${viewerStatePaths.removedScreenVariant}/index.html"]`,
  );
  const list = page.locator(`[data-nav-disclosure="variants:${parent}"]`);
  const home = navRow(page, parent);
  await changes.moveBase("head");
  const combined = await combinePublications(page);
  await page.goto(`/view/${parent}/`);
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(row).toHaveCount(0);
  await expect(home).not.toHaveAttribute("data-changed-variants", "true");

  await changes.moveBase("base");
  await combined.release();

  await expect(list.locator(row)).toHaveCount(1);
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(home).toHaveAttribute("data-changed-variants", "true");
  await expect(row).toBeHidden();

  await chooseFilter(page, "changed");
  await expect(row).toBeVisible();
  await expect(row).toContainText("Workspace deleted · Removed");
  await expect(home).toBeVisible();

  await page.fill("[data-mokly-search]", "Workspace deleted");
  await expect(row).toBeVisible();
  await expect(home).toBeVisible();
  await expect(navRow(page, changes.paths.changed)).toBeHidden();

  await page.fill("[data-mokly-search]", "");
  const retained = await row.elementHandle();
  await changes.edit(
    CONSUMER_SOURCE,
    consumerSource("Consumer renamed"),
    consumerTitled("Consumer renamed"),
  );
  await combined.release();
  await expect(navRow(page, changes.paths.consumer)).toContainText(
    "Consumer renamed",
  );
  expect(await retained!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(row).toHaveCount(1);

  await chooseFilter(page, "all");
  await changes.moveBase("head");
  await combined.release();
  await expect(row).toHaveCount(0);
  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(home).not.toHaveAttribute("data-changed-variants", "true");
});
