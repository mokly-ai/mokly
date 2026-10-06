import { expect, test } from "@playwright/test";

import { detailsRow } from "./browse_assertions.js";
import { chooseViewport } from "./workspace_actions.js";

test("path chips copy their path without navigating", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as Window & { __copiedPath?: string }).__copiedPath = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/view/example/screens/welcome/");
  const url = page.url();
  const pathChip = page.locator("[data-copy-path]");

  await expect(pathChip).toHaveText("example/screens/welcome");
  await pathChip.hover();
  expect(
    await pathChip.evaluate((element) => getComputedStyle(element).cursor),
  ).toBe("pointer");
  await page.mouse.down();
  const pressed = await pathChip.evaluate((element) => {
    const style = getComputedStyle(element);
    return { boxShadow: style.boxShadow, transform: style.transform };
  });
  expect(pressed.boxShadow).not.toBe("none");
  expect(pressed.transform).not.toBe("none");
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __copiedPath?: string }).__copiedPath,
      ),
    )
    .toBe("example/screens/welcome");
  await expect(page).toHaveURL(url);
  await expect(page.locator("#mb-status")).toHaveText(
    "Copied path example/screens/welcome",
  );
});

test("the address pill copies its address from its copy icon", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText(text: string) {
          (window as Window & { __copiedUrl?: string }).__copiedUrl = text;
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/view/example/screens/welcome/");
  const icon = page.locator(".browser-bar .address-copy svg");
  await expect(icon).toBeVisible();
  const box = await icon.boundingBox();
  expect(box?.width).toBe(13);
  expect(box?.height).toBe(13);

  await icon.click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __copiedUrl?: string }).__copiedUrl,
      ),
    )
    .toBe("example.test/welcome");
  await expect(page.locator(".address-copied")).toHaveText("URL copied");
});

test("the expand toggle swaps its icon while the frame is expanded", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  const expandIcon = page.locator(".browser-expand .i-expand svg");
  const collapseIcon = page.locator(".browser-expand .i-collapse svg");
  await expect(expandIcon).toBeVisible();
  await expect(collapseIcon).toBeHidden();
  const box = await expandIcon.boundingBox();
  expect(box?.width).toBe(13);
  expect(box?.height).toBe(13);

  await page.click(".browser-expand");
  await expect(expandIcon).toBeHidden();
  await expect(collapseIcon).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(expandIcon).toBeVisible();
  await expect(collapseIcon).toBeHidden();
});

test("the browser frame expands to an overlay and collapses again", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  await page.click(".browser-expand");
  await expect(page.locator(".browser-frame.is-expanded")).toBeVisible();
  expect(
    await page.evaluate(() =>
      document.body.classList.contains("frame-expanded"),
    ),
  ).toBe(true);
  await expect(page.locator(".browser-expand")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".browser-frame.is-expanded")).toHaveCount(0);
  await page.click(".browser-expand");
  await expect(page.locator(".browser-frame.is-expanded")).toBeVisible();
  await page.mouse.click(8, 300);
  await expect(page.locator(".browser-frame.is-expanded")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      document.body.classList.contains("frame-expanded"),
    ),
  ).toBe(false);
  await page.click(detailsRow);
  await expect(page.locator("#mb-main h2")).toHaveText("Details");
});

for (const width of [390, 1280])
  test(`phone decoration leaves the embedded preview hit-testable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/view/example/screens/welcome/");
    await chooseViewport(page, "mobile");
    const home = page.locator(".mbk-frame-mobile > .phone-frame > .phone-home");
    await home.scrollIntoViewIfNeeded();
    const hit = await home.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      return document.elementFromPoint(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      )?.tagName;
    });
    expect(hit).toBe("IFRAME");
    await expect(home).toHaveCSS("pointer-events", "none");
    await expect(home).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".mbk-frame-mobile .phone-notch")).toHaveCSS(
      "pointer-events",
      "none",
    );
  });
