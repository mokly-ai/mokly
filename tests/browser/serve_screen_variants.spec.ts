/**
 * Changes rows of screen variants in Serve, the screen counterpart of the
 * component variant journeys on the copied output: an unmodified parent
 * marks its changed variant, opens it from Changes, draws one accent dot,
 * and keeps a Removed row for its deleted variant.
 */

import { expect, type Page } from "@playwright/test";

import { comparisonPaths } from "../helpers/comparison_catalogue.js";
import {
  addViewerStateSources,
  viewerStatePaths as paths,
} from "../helpers/viewer_state_sources.js";

import { accentFill } from "./browse_assertions.js";
import { chooseFilter, navRow } from "./comparison_ui.js";
import { test } from "./serve_comparison_test.js";

test.use({ comparisonSources: { add: addViewerStateSources } });

const LIST = `[data-nav-disclosure="variants:${paths.variantParent}"]`;

/** The trailing changed dot the stylesheet draws, or `none` when unmarked. */
function changedDot(page: Page, entryPath: string) {
  return navRow(page, entryPath).evaluate((row) => {
    const style = getComputedStyle(row, "::after");
    return {
      color: style.backgroundColor,
      content: style.content,
      radius: style.borderTopLeftRadius,
      width: style.width,
    };
  });
}

/** How the row's accessible change wording resolves for assistive tech. */
function changedText(page: Page, entryPath: string) {
  return navRow(page, entryPath)
    .locator(".mbk-nav-changed-text")
    .evaluate((mark) => getComputedStyle(mark).display);
}

test("the Changes filter shows a changed variant under its marked parent", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await chooseFilter(page, "changed");

  await expect(navRow(page, paths.changedScreenVariant)).toBeVisible();
  await expect(navRow(page, paths.quietScreenVariant)).toBeHidden();
  await expect(page.locator(LIST)).toBeVisible();
  await expect(navRow(page, paths.variantParent)).toHaveAttribute(
    "data-changed-variants",
    "true",
  );
});

test("Changes opens the first changed variant of an unmodified parent", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await chooseFilter(page, "changed");
  const home = navRow(page, paths.variantParent);
  await expect(home).not.toHaveAttribute("data-changed", "true");
  await expect(home).toHaveAttribute("data-changed-variants", "true");

  await home.click();

  await expect(page).toHaveURL(
    new RegExp(`/view/${paths.changedScreenVariant}/$`, "u"),
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText("Save failed");
  await expect(navRow(page, paths.changedScreenVariant)).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator('button[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the changed mark draws one trailing dot the reader can hear", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await chooseFilter(page, "changed");
  const dot = { color: accentFill, content: '""', radius: "50%", width: "6px" };

  expect(await changedDot(page, paths.variantParent)).toEqual(dot);
  expect(await changedDot(page, paths.changedScreenVariant)).toEqual(dot);
  expect((await changedDot(page, paths.removedScreenVariant)).content).toBe(
    "none",
  );
  expect(await changedText(page, paths.changedScreenVariant)).toBe("block");
  expect(await changedText(page, paths.removedScreenVariant)).toBe("none");

  await navRow(page, paths.changedScreenVariant).click();
  await expect(navRow(page, paths.changedScreenVariant)).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(await changedDot(page, paths.changedScreenVariant)).toEqual({
    ...dot,
    color: "rgb(255, 255, 255)",
  });

  await chooseFilter(page, "all");
  expect((await changedDot(page, comparisonPaths.unchanged)).content).toBe(
    "none",
  );
  expect(await changedText(page, comparisonPaths.unchanged)).toBe("none");
});

test("a removed variant keeps a Removed row under its surviving parent", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  const gone = navRow(page, paths.removedScreenVariant);
  await expect(gone).toBeHidden();

  await chooseFilter(page, "changed");

  await expect(
    page.locator(
      `${LIST} a[data-nav-row][data-route="${paths.removedScreenVariant}/index.html"]`,
    ),
  ).toHaveCount(1);
  await expect(gone).toBeVisible();
  await expect(gone).toContainText("Workspace deleted · Removed");

  await gone.click();

  await expect(page).toHaveURL(
    new RegExp(
      `/view/${paths.removedScreenVariant}/\\?snapshot=[a-f0-9]{64}$`,
      "u",
    ),
  );
  await expect(page.locator(".mbk-screen-head h2")).toHaveText(
    "Workspace deleted",
  );
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  const crumb = page.getByLabel("Catalogue location").locator("a");
  await expect(crumb).toHaveText("Home");
  await expect(crumb).toHaveAttribute("href", `/view/${paths.variantParent}/`);

  await chooseFilter(page, "all");
  await expect(gone).toBeHidden();
  await expect(navRow(page, paths.variantParent)).toBeVisible();
});
