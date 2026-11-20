import { test } from "@playwright/test";

import { expectNotFoundRecovery, notFoundPaths } from "./not-found-cases";

for (const pathname of notFoundPaths) {
  test(`${pathname} renders the mobile recovery`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await expectNotFoundRecovery(page, pathname, true);
  });
}
