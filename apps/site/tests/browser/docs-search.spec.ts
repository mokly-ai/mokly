import { expect, test } from "@playwright/test";

import { openSearch } from "./search.js";

const PAGE = "/docs/start/install/";

/** A browser on macOS, whose search controls name ⌘K. */
const APPLE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

test("the search control, ⌘K, Ctrl K and / open search on a docs page", async ({
  page,
}) => {
  await page.goto(PAGE);
  // The Layers panel's control, or below 1024px the sub-bar's.
  const dialog = await openSearch(page);
  await expect(dialog.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  for (const key of ["Meta+k", "Control+k", "/"]) {
    await page.keyboard.press(key);
    await expect(dialog, key).toBeVisible();
    await expect(dialog.getByRole("searchbox"), key).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog, key).toBeHidden();
  }
  // In the search box, / types itself.
  await page.keyboard.press("/");
  await page.keyboard.press("/");
  await expect(dialog.getByRole("searchbox")).toHaveValue("/");
});

test(
  "the search control names ⌘K on Apple platforms and Ctrl K elsewhere",
  { tag: "@desktop" },
  async ({ baseURL, browser, page }) => {
    const control = (from: typeof page) =>
      from
        .getByRole("navigation", { name: "Documentation" })
        .getByRole("button", { name: "Search docs" });
    await page.goto(PAGE);
    // The island sets the hint once it binds the control.
    const dialog = await openSearch(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(control(page)).toHaveText(/Ctrl K$/);

    const apple = await browser.newContext({ baseURL, userAgent: APPLE });
    try {
      const mac = await apple.newPage();
      await mac.goto(PAGE);
      await expect(control(mac)).toHaveText(/⌘K$/);
    } finally {
      await apple.close();
    }
  },
);

test.describe("without script", () => {
  test.use({ javaScriptEnabled: false });

  test("the docs controls that need script do not show", async ({ page }) => {
    await page.goto(PAGE);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toHaveText("Install");
    await expect(page.getByRole("button", { name: "Search docs" })).toHaveCount(
      0,
    );
    await expect(
      page.locator('button[aria-controls="docs-layers"]'),
    ).toBeHidden();
  });
});
