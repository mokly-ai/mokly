import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

import { repositoryRoot } from "../helpers/fixture.js";

for (const viewport of ["desktop", "mobile"] as const)
  test(`${viewport}: the first changed member shows only its first changed view`, async ({
    page,
  }) => {
    await page.setViewportSize(
      viewport === "mobile"
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );
    await page.goto(
      pathToFileURL(
        path.join(
          repositoryRoot,
          "examples/basic/generated/design/browse/index-entries/member-changes",
          `index.${viewport}.html`,
        ),
      ).href,
    );
    const control = page.locator(".ce-viewport-control");
    await expect(
      page.getByLabel("Preview viewport", { exact: true }),
    ).toHaveValue("mobile");
    await expect(page.locator(".ce-preview-view:visible")).toHaveCount(1);
    await expect(
      page.locator('.ce-preview-view[data-preview-viewport="mobile"]'),
    ).toBeVisible();
    await expect(control.locator(".ce-view-changed")).toBeVisible();
    await expect(page.locator(".mbk-appearance .mbk-view-changed")).toHaveCount(
      0,
    );
    await expect(page.locator(".mbk-cmp-toolbar")).toBeVisible();
  });
