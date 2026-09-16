import { type Page, expect, test } from "@playwright/test";

import { PAGES } from "./routes.js";

/**
 * The home stage embeds catalogue documents in a frame with no permissions,
 * so the browser reports every script it refuses to run there. That report is
 * the sandbox working and is not a page failure.
 */
const SANDBOXED = /Blocked script execution in '[^']*\/stage\/[^']*'/;

/** Collect the failures a page must not produce while it loads. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(request.url()));
  page.on("console", (message) => {
    if (message.type() === "error" && !SANDBOXED.test(message.text()))
      errors.push(message.text());
  });
  return errors;
}

/** Every page renders exactly one landmark and one heading. */
async function assertStructure(page: Page, heading: string): Promise<void> {
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toHaveText(heading);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

for (const { route, title, heading } of PAGES) {
  test(`${route} renders one heading inside the shared chrome`, async ({
    page,
  }, testInfo) => {
    const errors = watch(page);
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await assertStructure(page, heading);
    await page.screenshot({
      path: testInfo.outputPath(`${route.replace(/\//g, "_")}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test(`${route} starts with the skip link and moves focus to main`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => document.activeElement?.className ?? ""),
    ).toBe("site-skip");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await page.evaluate(() => document.activeElement?.id ?? "")).toBe(
      "main",
    );
  });
}

test("the not-found document renders the shared chrome", async ({ page }) => {
  const response = await page.goto("/does-not-exist/");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found · Mokly");
  await assertStructure(page, "Page not found");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
});
