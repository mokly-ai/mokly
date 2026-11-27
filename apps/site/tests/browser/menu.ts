import { type Locator, type Page, expect } from "@playwright/test";

import { BREAKPOINT } from "./routes.js";

/** Whether the page draws the mobile composition, where the menu lists the destinations. */
export function narrow(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < BREAKPOINT;
}

/** Wait until every transition on the element and its backdrop has ended. */
export async function settle(element: Locator): Promise<void> {
  await element.evaluate((node) =>
    Promise.all(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/** Open the mobile menu and wait until its sheet has settled below the bar. */
export async function openMenu(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await settle(menu);
  return menu;
}
