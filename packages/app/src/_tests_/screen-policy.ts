import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Every registered screen owns one main landmark, one heading and a skip link
 * that comes first in the tab order, and its document title names Mokly once.
 * `label` names the screen in a failure.
 */
export async function expectScreenPolicy(
  page: Page,
  label: string,
): Promise<void> {
  await expect(
    page.locator("main, [role=main]"),
    `${label}: one main`,
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1 }),
    `${label}: one h1`,
  ).toHaveCount(1);
  const skip = page.locator("a.skip-link");
  await expect(skip, `${label}: skip link`).toHaveCount(1);
  await expect(skip).toHaveAttribute("href", "#main");
  const first = await page.evaluate(() => {
    const focusable = document.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    return focusable[0]?.className ?? "";
  });
  expect(first, `${label}: skip link is first in tab order`).toContain(
    "skip-link",
  );
  // The screen names the page and the suffix names the product, so a screen
  // whose heading also names the product would say it twice.
  const title = await page.title();
  expect(title.split("Mokly").length - 1, `${label}: names Mokly once`).toBe(1);
}
