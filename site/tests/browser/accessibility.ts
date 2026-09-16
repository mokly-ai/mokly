import { type Page, expect } from "@playwright/test";

/** Deterministic accessibility checks shared by every published route. */
export async function assertAccessibility(page: Page): Promise<void> {
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", /\S+/);
  await expect(
    page.locator('img:not([alt]):not([aria-hidden="true"])'),
  ).toHaveCount(0);
  for (const role of ["button", "link"] as const) {
    await expect(page.getByRole(role, { name: /^\s*$/ })).toHaveCount(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveCount(1);
    await expect(focused).not.toHaveCSS("outline-style", "none");
    await expect(focused).not.toHaveCSS("outline-style", "hidden");
    await expect(focused).not.toHaveCSS("outline-width", "0px");
  }
}
