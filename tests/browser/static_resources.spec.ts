import { expect } from "@playwright/test";

import { documentFavicon } from "./document_error_allowance.js";
import { test } from "./static_test.js";

test("copied portable documents work without scripts and shell routes explain the requirement", async ({
  browser,
  baseURL,
  allowBrowserError,
}) => {
  documentFavicon(allowBrowserError, baseURL!);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/view/example/screens/welcome/`);
    await expect(page.locator("noscript")).toBeVisible();
    expect(await page.locator("noscript").textContent()).toBe(
      "This catalogue needs JavaScript.",
    );
    await expect(page.locator("[data-mokly-shell]")).toBeEmpty();
    await page.goto(
      `${baseURL}/static/mokly-generated/example/screens/welcome/index.mobile.html`,
    );
    await page.getByRole("link", { name: "View details", exact: true }).click();
    await expect(page).toHaveURL(
      /\/example\/screens\/details\/index\.mobile\.html#details$/,
    );
    await page
      .locator('a[data-mokly-link-control="button"]')
      .filter({ hasText: "Return to welcome" })
      .click();
    await expect(page).toHaveURL(
      /\/example\/screens\/welcome\/index\.mobile\.html$/,
    );
  } finally {
    await context.close();
  }
});
