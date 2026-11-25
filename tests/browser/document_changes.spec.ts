/**
 * Folder indexes and related documents on the copied comparison output,
 * under the folder and document contracts. In Changes, an unmodified screen
 * index stays an undotted container and opens its first changed member. A
 * related document in Inspect's head opens its entry, labelled with its
 * title.
 */

import { expect } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { changedDot, chooseFilter, navRow } from "./comparison_ui.js";
import { inspectHead } from "./inspect_head.js";
import { mainHeading } from "./main_heading.js";

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

  // The landing's address names the first changed view's Mobile viewport.
  await expect(page).toHaveURL(
    new RegExp(
      `/view/${comparisonPaths.folderChanged}/\\?viewport=mobile$`,
      "u",
    ),
  );
  await expect(mainHeading(page, "Security")).toBeVisible();
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
  // Inspect's head lists the entry's related documents.
  const related = inspectHead(page).getByRole("link", {
    name: "Payment terms",
    exact: true,
  });
  await expect(related).toHaveAttribute(
    "href",
    `/view/${comparisonPaths.currentDocument}/`,
  );
  await related.click();
  await expect(page).toHaveURL(
    new RegExp(`/view/${comparisonPaths.currentDocument}/$`, "u"),
  );
  await expect(mainHeading(page, "Payment terms")).toBeVisible();
  await expect(navRow(page, comparisonPaths.currentDocument)).toHaveAttribute(
    "aria-current",
    "page",
  );
});
