import type { Locator, Page } from "@playwright/test";

/** Press Tab until `target` holds the focus, as a keyboard reader moves it. */
export async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let step = 0; step < 80; step += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement))
      return;
  }
  throw new Error("The control was not reachable with Tab");
}
