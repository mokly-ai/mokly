import { expect, test } from "@playwright/test";

import { settle } from "./menu.js";
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
  "a press on the dimmed page closes search, and a press inside it does not",
  { tag: "@desktop" },
  async ({ page }) => {
    await page.goto(PAGE);
    const dialog = await openSearch(page);
    await settle(dialog);
    const box = await dialog.boundingBox();
    const height = page.viewportSize()?.height ?? 0;
    if (!box) throw new Error("the open search dialog has no box");
    // A press on the padding at the dialog's foot keeps search open.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 8);
    expect(
      await dialog.evaluate((node) => (node as HTMLDialogElement).open),
    ).toBe(true);
    // A press on the dimmed page below the dialog closes it.
    await page.mouse.click(
      box.x + box.width / 2,
      (box.y + box.height + height) / 2,
    );
    await expect(dialog).toBeHidden();
  },
);

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

    const apple = await browser.newContext({
      ...(baseURL === undefined ? {} : { baseURL }),
      userAgent: APPLE,
    });
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
