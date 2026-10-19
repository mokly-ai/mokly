import { expect } from "@playwright/test";

import { accentFill } from "./browse_assertions.js";
import { comparisonPaths, test } from "./comparison_test.js";
import {
  changedDot,
  changedText,
  chooseFilter,
  navRow,
} from "./comparison_ui.js";

const CARD_LIST = `[data-nav-disclosure="variants:${comparisonPaths.component}"]`;
const TAG_LIST = `[data-nav-disclosure="variants:${comparisonPaths.quietParent}"]`;

test("the Changes filter shows a changed variant under its marked parent", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await chooseFilter(page, "changed");

  const card = navRow(page, comparisonPaths.component);
  await expect(card).toHaveAttribute("data-changed", "true");
  await expect(card).toHaveAttribute("data-changed-variants", "true");
  const list = page.locator(CARD_LIST);
  await expect(list).toBeVisible();
  for (const variant of [
    comparisonPaths.changedVariant,
    comparisonPaths.addedVariant,
    comparisonPaths.removedVariant,
  ])
    await expect(
      list.locator(`a[data-route="${variant}/index.html"]`),
    ).toBeVisible();
  await expect(navRow(page, comparisonPaths.changedVariant)).toHaveAttribute(
    "data-changed",
    "true",
  );
  // An unmodified sibling of a changed variant stays out of Changes.
  await expect(navRow(page, comparisonPaths.quietSibling)).toBeHidden();
  await expect(navRow(page, comparisonPaths.quietVariant)).toBeVisible();
});

test("Changes opens the first changed variant of an unmodified parent", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.unchanged}/`);
  await chooseFilter(page, "changed");
  const tag = navRow(page, comparisonPaths.quietParent);
  await expect(tag).not.toHaveAttribute("data-changed", "true");
  await expect(tag).toHaveAttribute("data-changed-variants", "true");

  await tag.click();

  await expect(page).toHaveURL(
    new RegExp(`/view/${comparisonPaths.quietVariant}/$`),
  );
  await expect(navRow(page, comparisonPaths.quietVariant)).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("[data-workspace-status]")).toHaveText("Changed");
  await expect(page.locator(`${TAG_LIST}`)).toBeVisible();
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

  expect(await changedDot(page, comparisonPaths.component)).toEqual(dot);
  expect(await changedDot(page, comparisonPaths.quietParent)).toEqual(dot);
  expect(await changedDot(page, comparisonPaths.changedVariant)).toEqual(dot);
  expect((await changedDot(page, comparisonPaths.removedVariant)).content).toBe(
    "none",
  );
  expect(await changedText(page, comparisonPaths.changedVariant)).toBe("block");
  expect(await changedText(page, comparisonPaths.removedVariant)).toBe("none");

  await navRow(page, comparisonPaths.changedVariant).click();
  await expect(navRow(page, comparisonPaths.changedVariant)).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(await changedDot(page, comparisonPaths.changedVariant)).toEqual({
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
  await page.goto(`/view/${comparisonPaths.component}/`);
  // The parent's own page and row render before the hidden check.
  await expect(page.locator("#mb-main h2").first()).toHaveText("Card");
  await expect(navRow(page, comparisonPaths.component)).toBeVisible();
  const removed = navRow(page, comparisonPaths.removedVariant);
  await expect(removed).toBeHidden();

  await chooseFilter(page, "changed");

  await expect(page.locator(`${CARD_LIST} a[data-nav-row]`)).toContainText([
    "Featured",
    "Fresh",
    "Archived · Removed",
  ]);
  await expect(removed).toBeVisible();

  await removed.click();

  await expect(page).toHaveURL(
    new RegExp(`/view/${comparisonPaths.removedVariant}/`),
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText("Card");
  await expect(page.locator("[data-workspace-status]")).toHaveText("Removed");
  // The surviving parent keeps its own status, so the stage names the variant.
  await expect(
    page.getByRole("heading", {
      name: "This variant was removed",
      exact: true,
    }),
  ).toBeVisible();
  // The variant bar and Details link back to the surviving parent.
  for (const region of ["Saved variants", "Details"])
    await expect(
      page
        .getByRole(region === "Details" ? "tabpanel" : "navigation", {
          name: region,
        })
        .getByRole("link", { name: "Card", exact: true }),
    ).toHaveAttribute("href", `/view/${comparisonPaths.component}/`);

  await chooseFilter(page, "all");
  await expect(removed).toBeHidden();
  await expect(navRow(page, comparisonPaths.component)).toBeVisible();
});
