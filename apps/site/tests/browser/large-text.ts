import { type Page, expect } from "@playwright/test";

/**
 * The narrowest window that docs/protocol/cloud/site-design.md keeps usable
 * at 200% text. The root's font size doubles, as a reader's text size does
 * for every rem size; a width query in em would not follow it, and a
 * container query in rem does.
 */
export const NARROW_WIDTH = 320;

/**
 * Open a route in a 320px window with 200% text, or with the text size that
 * `percent` names, once the size holds.
 */
export async function openLargeText(
  page: Page,
  route: string,
  percent = 200,
): Promise<void> {
  await page.setViewportSize({ height: 900, width: NARROW_WIDTH });
  await page.goto(route);
  if (percent !== 100)
    await page.addStyleTag({ content: `html { font-size: ${percent}%; }` });
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
    )
    .toBe(`${(16 * percent) / 100}px`);
}

/** The width that the page scrolls to, which is the window's when it fits. */
export function scrollWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}
