/**
 * Folder indexes and related documents on the copied comparison output,
 * under the folder and document contracts. In Changes, an unmodified screen
 * index stays an undotted container and opens its first changed member. A
 * related document in Details opens its entry, labelled with its title.
 */

import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { changedDot, chooseFilter, navRow } from "./comparison_ui.js";

test("an unmodified index row stays an undotted container and opens its first changed member", async ({
  page,
}) => {
  await page.goto(`/view/${comparisonPaths.folderQuiet}/`);
  await chooseFilter(page, "changed");
  const index = navRow(page, comparisonPaths.folderIndex);
  await expect(index).toBeVisible();
  await expect(index).not.toHaveAttribute("data-changed", "true");
  await expect(index).not.toHaveAttribute("data-changed-variants", "true");
  expect((await changedDot(page, comparisonPaths.folderIndex)).content).toBe(
    "none",
  );
  await expect(navRow(page, comparisonPaths.folderChanged)).toBeVisible();
  expect(
    (await changedDot(page, comparisonPaths.folderChanged)).content,
  ).not.toBe("none");
  await expect(navRow(page, comparisonPaths.folderQuiet)).toBeHidden();

  await index.click();

  await expect(page).toHaveURL(
    new RegExp(`/view/${comparisonPaths.folderChanged}/$`, "u"),
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText("Security");
  await expect(navRow(page, comparisonPaths.folderChanged)).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator('button[data-filter="changed"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a related document opens its entry, labelled with its title", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/view/${comparisonPaths.folderIndex}/`);
  const tab = page.getByRole("tab", { name: "Details", exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  const related = page
    .getByRole("tabpanel", { name: "Details" })
    .getByRole("link", { name: "Payment terms", exact: true });
  await expect(related).toHaveAttribute(
    "href",
    `/view/${comparisonPaths.currentDocument}/`,
  );
  await related.click();
  await expect(page).toHaveURL(
    new RegExp(`/view/${comparisonPaths.currentDocument}/$`, "u"),
  );
  await expect(page.locator("#mb-main h2").first()).toHaveText("Payment terms");
  await expect(navRow(page, comparisonPaths.currentDocument)).toHaveAttribute(
    "aria-current",
    "page",
  );
});
