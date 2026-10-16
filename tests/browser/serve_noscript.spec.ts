import { expect } from "@playwright/test";

import { test } from "./browser_test.js";

test.use({ javaScriptEnabled: false, colorScheme: "dark" });
test("the Serve stub explains its JavaScript requirement", async ({ page }) => {
  await page.goto("/view/example/screens/welcome/");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(22, 21, 18)",
  );
  await expect(page.locator("noscript")).toBeVisible();
  expect(await page.locator("noscript").textContent()).toBe(
    "This catalogue needs JavaScript.",
  );
  await expect(page.locator("[data-mokly-shell]")).toBeEmpty();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
});
