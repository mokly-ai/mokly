import { expect, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import {
  changesPaths,
  chooseFilter,
  comparisonIndex,
  navFolder,
  navRow,
  showMode,
} from "./comparison_ui.js";
import { chooseViewport } from "./workspace_actions.js";

/** Visible catalogue rows, by entry path. */
function visibleRows(page: Page): Promise<string[]> {
  return page.locator("nav.mbk-nav a[data-nav-row]").evaluateAll((rows) =>
    rows
      .filter((row) => row.checkVisibility())
      .map((row) => row.getAttribute("data-entry-id") ?? "")
      .sort(),
  );
}

/** A folder's monospace child count. */
function folderCount(page: Page, folder: string) {
  return navFolder(page, folder).locator(":scope > summary .mbk-nav-count");
}

test("Changes lists, counts and marks exactly the entries the index includes", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  const included = changesPaths(index);
  expect(included).toHaveLength(13);
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await expect(
    page.locator('button[data-filter="changed"] .mbk-nav-filter-count'),
  ).toHaveText(String(included.length));
  for (const entry of [...index.screens, ...index.components]) {
    const row = navRow(page, entry.path);
    if (entry.changes?.included)
      await expect(row, entry.path).toHaveAttribute("data-changed", "true");
    else await expect(row, entry.path).not.toHaveAttribute("data-changed");
  }
  await expect(folderCount(page, "screens")).toHaveText("5");
  await expect(folderCount(page, "components")).toHaveText("2");

  await chooseFilter(page, "changed");
  // A parent that only holds a changed variant stays as an unmarked container.
  await expect
    .poll(() => visibleRows(page))
    .toEqual([...included, comparisonPaths.quietParent].sort());
  await expect(navRow(page, comparisonPaths.quietParent)).not.toHaveAttribute(
    "data-changed",
  );
  await expect(navRow(page, comparisonPaths.quietParent)).toHaveAttribute(
    "data-changed-variants",
    "true",
  );
  await expect(folderCount(page, "screens")).toHaveText("3");
  await expect(folderCount(page, "components")).toHaveText("2");
  await expect(
    page.locator('button[data-filter="changed"] .mbk-nav-filter-count'),
  ).toHaveText(String(included.length));
});

test("an affected consumer stays out of Changes while its changed component lists it", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.component}/`);
  await page.getByRole("tab", { name: "Usage" }).click();
  const affected = page.locator('[data-usage-section="affected"]');
  await expect(affected.getByRole("heading")).toHaveText(
    "Affected screens and components",
  );
  await expect(affected.getByRole("link")).toHaveText([
    "Changed screen",
    "Consumer screen",
  ]);
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.consumer)).toBeHidden();
  await expect(navRow(page, comparisonPaths.changed)).toBeVisible();
  await chooseFilter(page, "all");
  await expect(navRow(page, comparisonPaths.consumer)).toBeVisible();
  await expect(navRow(page, comparisonPaths.consumer)).not.toHaveAttribute(
    "data-changed",
  );
});

test("Changed navigation preserves collapsed unrelated groups", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseFilter(page, "changed");
  const components = navFolder(page, "components");
  await expect(components).toHaveAttribute("open", "");
  await components.locator(":scope > summary").click();
  await expect(components).not.toHaveAttribute("open", "");

  await navRow(page, comparisonPaths.darkOnly).click();

  await expect(page.locator("#mb-main h2").first()).toHaveText("Dusk screen");
  await expect(page.locator('button[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(components).not.toHaveAttribute("open", "");
});

test("editing an active filter reveals newly matching groups", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseFilter(page, "changed");
  const components = navFolder(page, "components");
  await components.locator(":scope > summary").click();
  await expect(components).not.toHaveAttribute("open", "");

  await page.fill("[data-mokly-search]", "bold");

  await expect(components).toHaveAttribute("open", "");
  await expect(navRow(page, comparisonPaths.quietVariant)).toBeVisible();
  await expect(navRow(page, comparisonPaths.changed)).toBeHidden();
});

test("clearing filtering keeps the destination folder open", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.changed}/`);
  const components = navFolder(page, "components");
  await components.locator(":scope > summary").click();
  await expect(components).not.toHaveAttribute("open", "");
  await chooseFilter(page, "changed");

  await navRow(page, comparisonPaths.component).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Card");
  await chooseFilter(page, "all");

  await expect(components).toHaveAttribute("open", "");
  await expect(navRow(page, comparisonPaths.component)).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Changes keeps resized navigation across diff modes and screen navigation", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1_280 });
  const reviews: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/mokly-viewer/diffs/"))
      reviews.push(request.url());
  });
  await page.goto(`/view/${comparisonPaths.changed}/`);
  await chooseFilter(page, "changed");
  await chooseViewport(page, "desktop");
  const nav = page.locator("[data-mokly-nav]");
  const handle = page.getByRole("separator", {
    name: "Resize navigation panel",
  });
  await expect(handle).toBeVisible();
  const start = Number(await handle.getAttribute("aria-valuenow"));
  const grip = await handle.boundingBox();
  if (!grip) throw new Error("navigation resize bounds unavailable");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 100);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 64, grip.y + 100);
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", String(start + 64));
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(start + 64, 0);
  expect(reviews).toEqual([]);

  await showMode(page, "Overlay");
  await expect(handle).toHaveAttribute("aria-valuenow", String(start + 64));
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  const stepped = Number(await handle.getAttribute("aria-valuenow"));
  expect(stepped).toBeLessThan(start + 64);
  for (const mode of ["Difference", "Current"] as const) {
    await page
      .getByRole("group", { name: "Comparison mode" })
      .getByRole("button", { name: mode, exact: true })
      .click();
    await expect(handle).toBeVisible();
    await expect
      .poll(async () => (await nav.boundingBox())?.width)
      .toBeCloseTo(stepped, 0);
  }
  await chooseFilter(page, "all");
  await navRow(page, comparisonPaths.unchanged).click();
  await expect(page.locator("#mb-main h2").first()).toHaveText("Stable screen");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(stepped, 0);
  await page.reload();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(stepped, 0);
  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByRole("button", { name: "Open catalogue navigation" }).click();
  await expect(nav).toBeVisible();
  await expect(handle).toBeHidden();
});
