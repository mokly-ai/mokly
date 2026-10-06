import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

for (const width of [390, 1280]) {
  test(`standalone phone designs retain non-interactive decoration at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const viewport = width < 700 ? "mobile" : "desktop";
    const file = path.join(
      repositoryRoot,
      `examples/basic/generated/design/library/preview/device-frame/phone/index.${viewport}.html`,
    );
    await page.goto(pathToFileURL(file).href);
    for (const selector of [".phone-home", ".phone-notch"]) {
      const decoration = page.locator(selector);
      await expect(decoration).toBeVisible();
      await expect(decoration).toHaveCSS("pointer-events", "none");
    }
  });
}
