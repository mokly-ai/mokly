import { expect, test } from "@playwright/test";

import {
  computedStyle,
  openScreensGroup,
  welcomeRow,
} from "./browse_assertions.js";

test("desktop catalogue navigation resizes and remembers its width", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1_280 });
  await page.goto("/");
  const nav = page.locator("[data-mokly-nav]");
  const handle = page.locator("[data-mokly-nav-resize]");
  await expect(handle).toBeVisible();
  await expect(handle).toHaveAttribute("role", "separator");

  const start = await nav.boundingBox();
  const grip = await handle.boundingBox();
  expect(start).not.toBeNull();
  expect(grip).not.toBeNull();
  expect(start?.width).toBeCloseTo(248, 0);
  if (!start || !grip) throw new Error("navigation resize bounds unavailable");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 100);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 80, grip.y + 100);
  await page.mouse.up();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(328, 0);

  await page.reload();
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(328, 0);

  await handle.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(192, 0);
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(208, 0);
  await page.keyboard.press("End");
  await expect
    .poll(async () => (await nav.boundingBox())?.width)
    .toBeCloseTo(480, 0);
  await expect(handle).toHaveAttribute("aria-valuenow", "480");
});

test("narrow viewports collapse navigation into a drawer", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 420 });
  await page.goto("/");
  await expect(page.locator("[data-mokly-nav]")).toBeHidden();
  await expect(page.locator("[data-mokly-nav-resize]")).toBeHidden();
  await page.click("[data-mokly-menu]");
  await expect(page.locator("[data-mokly-nav]")).toBeVisible();
  await expect(page.locator("[data-mokly-menu]")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(await computedStyle(page, ".mbk-topbar", "position")).toBe("relative");
  expect(await computedStyle(page, ".mbk-topbar", "zIndex")).toBe("11");
  await openScreensGroup(page);
  await page.click(welcomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator("[data-mokly-nav]")).toBeHidden();
});

test("the narrow search bar drops the name and fits its controls", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  const bar = await page.locator(".mbk-topbar").evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(bar.scroll).toBeLessThanOrEqual(bar.client);
  await expect(page.locator(".mbk-brand .mbk-mark")).toBeVisible();
  await expect(page.locator(".mbk-brand .mbk-mark svg")).toBeVisible();
  await expect(page.locator(".mbk-brand .mbk-mark")).toHaveCSS("width", "22px");
  await expect(page.locator(".mbk-brand .mbk-mark svg")).toHaveCSS(
    "width",
    "22px",
  );
  await expect(page.locator(".mbk-brand .mbk-name")).toBeHidden();
  await expect(page.getByRole("link", { name: "Mokly" })).toBeVisible();
  await expect(page.locator("[data-mokly-menu]")).toBeVisible();
  await expect(page.locator("[data-mokly-search]")).toBeVisible();

  const modes = await page.locator(".mbk-search").boundingBox();
  if (!modes) throw new Error("the search must be laid out");
  expect(modes.x).toBeGreaterThanOrEqual(0);
  expect(modes.x + modes.width).toBeLessThanOrEqual(390);

  await page.setViewportSize({ height: 800, width: 1_280 });
  await expect(page.locator(".mbk-brand .mbk-name")).toBeVisible();
});

test("the removed Review route keeps a usable not-found shell", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const response = await page.goto("/review");
  expect(response?.status()).toBe(404);
  await expect(page.locator("[data-mokly-search]")).toBeVisible();
  await expect(page.locator("#mb-main h2")).toHaveText("Item not found");
});

test("missing routes keep the catalogue available", async ({ page }) => {
  await page.goto("/view/unknown.html");
  await expect(page.locator("#mb-main h2")).toHaveText("Item not found");
  await expect(page.locator("[data-mokly-nav]")).toBeVisible();
  await openScreensGroup(page);
  await page.click(welcomeRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
});

test("the shell is keyboard navigable with a skip link", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".mbk-skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mb-main")).toBeFocused();
  await openScreensGroup(page);
  await page.locator(welcomeRow).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator("#mb-main")).toBeFocused();
});

test("the shell works without JavaScript", async ({ baseURL, browser }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto("/");
  await page
    .locator('details[data-nav-folder="folder:example/screens"] summary')
    .click();
  await page.click(welcomeRow);
  await expect(page).toHaveURL(/welcome\/$/);
  await expect(page.locator("#mb-main h2")).toHaveText("Welcome");
  await expect(page.locator(".mbk-frame-mobile")).toBeVisible();
  await expect(page.locator(".mbk-frame-desktop")).toBeVisible();
  await context.close();
});
