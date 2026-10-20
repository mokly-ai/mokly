/**
 * The Scroll together choice persists across entries and reloads on every
 * delivery that serves native comparisons, under the Scroll together contract.
 */

import { expect } from "@playwright/test";

import { comparisonPaths } from "../helpers/comparison_catalogue.js";

import { test as baseTest } from "./browser_test.js";
import { openComparison, scrollTogether } from "./comparison_scroll.js";
import { modeButton } from "./comparison_ui.js";

/** The storage key of the Scroll together contract. */
const SCROLL_TOGETHER_KEY = "mokly:comparison-scroll-together";

/** Register the persistence case on the host that `test` supplies. */
export function registerScrollTogetherMemory(test = baseTest): void {
  const changed = comparisonPaths.changed;

  test("Scroll together is remembered across screens and reloads", async ({
    page,
  }) => {
    await openComparison(page, changed, "desktop", "Overlay");
    await scrollTogether(page).click();
    await expect(scrollTogether(page)).not.toBeChecked();
    expect(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        SCROLL_TOGETHER_KEY,
      ),
    ).toBe("off");

    await openComparison(page, comparisonPaths.component, "desktop", "Overlay");
    await expect(scrollTogether(page)).not.toBeChecked();

    await page.reload();
    await modeButton(page, "Side by side").click();
    await expect(scrollTogether(page)).not.toBeChecked();
    await scrollTogether(page).click();
    await expect(scrollTogether(page)).toBeChecked();
    expect(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        SCROLL_TOGETHER_KEY,
      ),
    ).toBe("on");

    await page.evaluate(
      (key) => localStorage.setItem(key, "maybe"),
      SCROLL_TOGETHER_KEY,
    );
    await page.reload();
    await modeButton(page, "Overlay").click();
    await expect(scrollTogether(page)).toBeChecked();
  });
}
