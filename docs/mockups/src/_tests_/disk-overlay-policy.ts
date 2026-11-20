/** Check one Tab press per counted panel control on the loaded disk page, then blur. */

import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function checkDiskOverlay(page: Page) {
  if (!(await page.locator(".fo-viewer-backdrop").count())) return;
  await expect(page.locator(".fo-viewer-backdrop")).toHaveAttribute(
    "inert",
    "",
  );
  const controls = await page
    .locator(".fo-viewer-surface")
    .evaluate(
      (surface) =>
        [...surface.querySelectorAll<HTMLElement>("*")].filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            !element.closest('[inert], [aria-hidden="true"]') &&
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden",
        ).length,
    );
  expect(controls, "the open panel needs a keyboard control").toBeGreaterThan(
    0,
  );
  for (let step = 0; step < controls; step++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest(".fo-viewer-surface"),
      ),
      "Tab must stay in the viewer panel",
    ).toBe(true);
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
  });
}
