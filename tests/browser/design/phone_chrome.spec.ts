import { expect, test } from "@playwright/test";

import { designArtboardUrl } from "./artboards.js";

for (const width of [390, 1280]) {
  test(`standalone phone designs retain non-interactive decoration at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const viewport = width < 700 ? "mobile" : "desktop";
    await page.goto(
      designArtboardUrl("design/library/preview/device-frame/phone", viewport),
    );
    for (const selector of [".phone-home", ".phone-notch"]) {
      const decoration = page.locator(selector);
      await expect(decoration).toBeVisible();
      await expect(decoration).toHaveCSS("pointer-events", "none");
    }
  });
}
