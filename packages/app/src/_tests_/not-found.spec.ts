import { test } from "@playwright/test";

import { expectNotFoundRecovery, notFoundPaths } from "./not-found-cases";

for (const pathname of notFoundPaths) {
  test(`${pathname} renders the desktop recovery`, async ({ page }) => {
    await expectNotFoundRecovery(page, pathname);
  });
}
