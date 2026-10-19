/**
 * An unreferenced source edit on the copied comparison output, under the CSS
 * evidence shell contract. The second commit of the fixture edits
 * `notes.txt`, which no entry references. A screen and a component whose
 * only stylesheet stays the same list no changed file in All, end with their
 * own status line, and stay out of Changes.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { comparisonPaths, test } from "./comparison_test.js";
import { chooseFilter, navRow } from "./comparison_ui.js";

const BASE = "Compared with the branch point on fixture-base.";
const FILES_LEAD = "Changes to these files may affect this screen:";
const COMPONENT_FILES_LEAD =
  "Changes to these files may affect this component:";

/** Open an entry in All and return its comparison details. */
async function detailsInAll(page: Page, entry: string): Promise<Locator> {
  await page.goto(`/view/${entry}/`);
  await expect(page.locator('button[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const tab = page.getByRole("tab", { name: "Details", exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  const evidence = page.locator("[data-workspace-evidence]");
  await expect(evidence).toBeVisible();
  return evidence;
}

test("changed source paths alone add no screen evidence in All", async ({
  page,
}) => {
  const evidence = await detailsInAll(page, comparisonPaths.plainScreen);
  await expect(evidence.locator("p")).toHaveText([
    BASE,
    "No changes to this screen.",
  ]);
  await expect(evidence.getByText(FILES_LEAD, { exact: true })).toHaveCount(0);
  await expect(evidence.getByRole("listitem")).toHaveCount(0);
});

test("a real unreferenced source edit adds no screen or component evidence in All", async ({
  page,
}) => {
  const screen = await detailsInAll(page, comparisonPaths.plainScreen);
  await expect(screen.getByRole("listitem")).toHaveCount(0);
  const component = await detailsInAll(page, comparisonPaths.plainComponent);
  await expect(component.locator("p")).toHaveText([
    BASE,
    "No changes to this saved view.",
  ]);
  await expect(
    component.getByText(COMPONENT_FILES_LEAD, { exact: true }),
  ).toHaveCount(0);
  await expect(component.getByRole("listitem")).toHaveCount(0);
  await chooseFilter(page, "changed");
  for (const entry of [
    comparisonPaths.plainScreen,
    comparisonPaths.plainComponent,
  ])
    await expect(navRow(page, entry)).toBeHidden();
});
