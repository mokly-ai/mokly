import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Open the documentation search dialog and answer it. The page draws the
 * search control, in the Layers panel or in the sub-bar, but the search
 * island binds it only once the browser is idle, and a press that lands
 * before then does nothing; press until the dialog opens.
 */
export async function openSearch(page: Page): Promise<Locator> {
  const dialog = page.getByRole("dialog", {
    name: "Search the documentation",
  });
  await expect(async () => {
    await page.getByRole("button", { name: "Search docs" }).click();
    await expect(dialog).toBeVisible();
  }).toPass();
  return dialog;
}
