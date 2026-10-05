/** Shared locators and checks for the moved-changes browser cases. */

import { expect, type Page } from "@playwright/test";

import { captureBrowserErrors } from "./console_notices.js";

export const INVOICE = "account/billing/invoice";
export const ACTION = "ui/action";

/** The catalogue row for one entry. */
export function row(page: Page, entry: string) {
  return page.locator(`nav.mbk-nav a[data-nav-row][data-entry-id="${entry}"]`);
}

/** The trailing changed dot the stylesheet draws, or `none` when unmarked. */
export function dot(page: Page, entry: string): Promise<string> {
  return row(page, entry).evaluate(
    (element) => getComputedStyle(element, "::after").content,
  );
}

/** Record unexpected console errors and page errors in moved-entry checks. */
export function consoleErrors(page: Page): string[] {
  return captureBrowserErrors(page);
}

/** Select the Details panel, which some entries open with already. */
export async function showDetails(page: Page): Promise<void> {
  const details = page.getByRole("tab", { name: "Details", exact: true });
  if ((await details.getAttribute("aria-selected")) !== "true")
    await details.click();
  await expect(details).toHaveAttribute("aria-selected", "true");
}

/** Open the narrow layout's drawer when the catalogue is behind it. */
export async function showCatalogue(page: Page): Promise<void> {
  const menu = page.locator("[data-mokly-menu]");
  if (await menu.isVisible()) await menu.click();
}

/** Expect each visible row's label and whether All draws its changed mark. */
export async function expectMarks(
  page: Page,
  rows: readonly (readonly [entry: string, label: string, marked: boolean])[],
): Promise<void> {
  for (const [entry, label, marked] of rows) {
    await expect(row(page, entry)).toHaveAccessibleName(
      marked ? `${label} Changed` : label,
    );
    if (marked) expect(await dot(page, entry)).not.toBe("none");
    else expect(await dot(page, entry)).toBe("none");
  }
}
