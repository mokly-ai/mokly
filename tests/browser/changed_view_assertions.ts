import { expect, type Page } from "@playwright/test";

export const HOME = "fixture/screens/home/index.html";

export const HOME_PATH = "fixture/screens/home";

export const HOME_ROW = `a[data-nav-row][data-route="${HOME}"]`;

export const SCHEME_DOT = '[data-view-changed="scheme"]';

export const VIEWPORT_DOT = '[data-view-changed="viewport"]';

export const TOOLBAR = ".mbk-diff-toolbar";

/** The mark's painted geometry, so a hidden dot cannot pass as a drawn one. */
export async function dotStyle(page: Page, selector: string) {
  return page.locator(selector).evaluate((mark) => {
    const style = getComputedStyle(mark);
    return {
      display: style.display,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
      width: style.width,
    };
  });
}

export async function expectShownStatus(
  page: Page,
  status: "Changed" | "Unmodified",
  comparison: boolean,
): Promise<void> {
  await expect(page.locator("[data-workspace-status]")).toHaveText(status);
  if (comparison) await expect(page.locator(TOOLBAR)).toBeVisible();
  else await expect(page.locator(TOOLBAR)).toBeHidden();
}
