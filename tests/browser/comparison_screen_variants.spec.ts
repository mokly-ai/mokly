/**
 * Screen variants in Changes on the copied comparison output, under the
 * variant navigation contract. A screen parent whose own views stay
 * unmodified marks only its changed variants. Changes shows the changed and
 * the removed variant under it, hides the unmodified variant, and opens the
 * first changed variant from the parent row. A removed variant opens its
 * previous version and links back to its parent.
 */

import { expect } from "@playwright/test";

import { accentFill } from "./browse_assertions.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  changedDot,
  changedText,
  chooseFilter,
  navRow,
} from "./comparison_ui.js";

const LIST = `[data-nav-disclosure="variants:${comparisonPaths.screenParent}"]`;

test("the Changes filter shows a changed screen variant under its marked parent", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await chooseFilter(page, "changed");
  await expect(navRow(page, comparisonPaths.screenVariant)).toBeVisible();
  await expect(navRow(page, comparisonPaths.screenSibling)).toBeHidden();
  await expect(page.locator(LIST)).toBeVisible();
  await expect(navRow(page, comparisonPaths.screenParent)).toHaveAttribute(
    "data-changed-variants",
    "true",
  );
});

test("Changes opens the first changed variant of an unmodified screen parent", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await chooseFilter(page, "changed");
  const parent = navRow(page, comparisonPaths.screenParent);
  await expect(parent).not.toHaveAttribute("data-changed", "true");
  await expect(parent).toHaveAttribute("data-changed-variants", "true");

  await parent.click();

  await expect(page).toHaveURL(
    new RegExp(`/view/${comparisonPaths.screenVariant}/$`, "u"),
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText("Save failed");
  await expect(navRow(page, comparisonPaths.screenVariant)).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator('button[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the changed mark draws one trailing dot on screen variants", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await chooseFilter(page, "changed");
  const dot = { color: accentFill, content: '""', radius: "50%", width: "6px" };

  expect(await changedDot(page, comparisonPaths.screenParent)).toEqual(dot);
  expect(await changedDot(page, comparisonPaths.screenVariant)).toEqual(dot);
  expect(
    (await changedDot(page, comparisonPaths.screenRemovedVariant)).content,
  ).toBe("none");
  expect(await changedText(page, comparisonPaths.screenVariant)).toBe("block");
  expect(await changedText(page, comparisonPaths.screenRemovedVariant)).toBe(
    "none",
  );

  await navRow(page, comparisonPaths.screenVariant).click();
  await expect(navRow(page, comparisonPaths.screenVariant)).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(await changedDot(page, comparisonPaths.screenVariant)).toEqual({
    ...dot,
    color: "rgb(255, 255, 255)",
  });

  await chooseFilter(page, "all");
  await expect(navRow(page, comparisonPaths.screenSibling)).toBeVisible();
  expect((await changedDot(page, comparisonPaths.screenSibling)).content).toBe(
    "none",
  );
  expect(await changedText(page, comparisonPaths.screenSibling)).toBe("none");
});

test("a removed screen variant keeps a Removed row under its surviving parent", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.screenParent}/`);
  const removed = navRow(page, comparisonPaths.screenRemovedVariant);
  await expect(removed).toBeHidden();

  await chooseFilter(page, "changed");

  await expect(page.locator(`${LIST} a[data-nav-row]`)).toContainText([
    "Save failed",
    "Workspace deleted · Removed",
  ]);
  await expect(removed).toBeVisible();

  await removed.click();

  await expect(page).toHaveURL(
    new RegExp(`/view/${comparisonPaths.screenRemovedVariant}/`, "u"),
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText(
    "Workspace deleted",
  );
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  await expect(
    page
      .getByLabel("Catalogue location")
      .getByRole("link", { name: "Workspace screen", exact: true }),
  ).toHaveAttribute("href", `/view/${comparisonPaths.screenParent}/`);

  await chooseFilter(page, "all");
  await expect(removed).toBeHidden();
  await expect(navRow(page, comparisonPaths.screenParent)).toBeVisible();
});
