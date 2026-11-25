import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import {
  DESKTOP,
  DOWN_TO_END,
  UP_FROM_END,
  expectNear,
  scrollAboveEnd,
  settled,
  stepThrough,
  windowWidth,
  zoomPill,
} from "./home-zoom.js";
import { scrollWidth } from "./large-text.js";

/**
 * The home's zoom pill in a real browser, as the Home zoom section of
 * docs/protocol/cloud/site-chrome.md and the Zoom of
 * docs/protocol/cloud/site-design-pages.md fix it: the group and its
 * buttons, the steps from 8% to 200%, a button at its end that keeps focus,
 * the sideways scroll above 100% with the bars in place, the pill's place
 * once the layout settles after each press, also with reduced motion and
 * under a pointer that stays put, the measured values at every zoom, and
 * the depicted pill without script.
 * `home-zoom-scale.spec.ts` checks the scaled layout and the Specs panel,
 * `home-zoom-scrollbar.spec.ts` the layout with classic scrollbars, and
 * `tests/home_zoom.test.ts` and `tests/home_zoom_island.test.ts` check the
 * steps and the island's decisions against a stub page.
 */

test("the zoom pill steps the home down to 8% and up to 200%, and a button at its end keeps focus", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  const { group, zoomIn, zoomOut } = zoomPill(page);
  await expect(group).toMatchAriaSnapshot(`
    - group "Zoom":
      - button "Zoom out"
      - text: 100%
      - button "Zoom in"
  `);
  await stepThrough(group, zoomOut, ["80%", "64%", "51%", "41%", "33%"]);
  await stepThrough(group, zoomOut, ["26%", "21%", "17%", "13%", "11%"]);
  await stepThrough(group, zoomOut, ["9%", "8%", "8%"]);
  await expect(zoomOut).toHaveAttribute("aria-disabled", "true");
  await expect(zoomOut).toBeFocused();

  await stepThrough(group, zoomIn, ["10%", "13%", "16%", "20%", "24%"]);
  await expect(zoomOut).not.toHaveAttribute("aria-disabled");
  await stepThrough(group, zoomIn, ["31%", "38%", "48%", "60%", "75%"]);
  await stepThrough(group, zoomIn, ["100%", "125%", "156%", "195%"]);
  await stepThrough(group, zoomIn, ["200%", "200%"]);
  await expect(zoomIn).toHaveAttribute("aria-disabled", "true");
  await expect(zoomIn).toBeFocused();
  for (const button of [zoomIn, zoomOut])
    await expect(button).not.toHaveAttribute("disabled");

  // A pointer press steps too. Nothing keeps the zoom: a reload starts at
  // 100%, and the address never holds it.
  const address = page.url();
  await zoomOut.click();
  await expect(group).toHaveText("−160%+");
  expect(page.url()).toBe(address);
  await page.reload();
  await expect(zoomPill(page).group).toHaveText("−100%+");
});

test("above 100% the home scrolls sideways while the tool bar and the status bar keep their place", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  const { group, zoomIn, zoomOut } = zoomPill(page);
  const width = await windowWidth(page);
  await zoomIn.focus();
  const rest = await group.boundingBox();
  expect(await scrollWidth(page)).toBe(width);

  await stepThrough(group, zoomIn, ["125%", "156%", "195%", "200%"]);
  await expect.poll(() => scrollWidth(page)).toBe(2 * width);
  // The reader scrolls to the right end of the page.
  await page.mouse.move(width / 2, 300);
  await page.mouse.wheel(2 * width, 0);
  await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(width);
  const band = await page.getByRole("banner").boundingBox();
  expect([band?.x, band?.width]).toEqual([0, width]);
  const moved = await group.boundingBox();
  expect(moved?.x).toBeCloseTo(rest?.x ?? Number.NaN, 0);
  expect(moved?.width).toBeCloseTo(rest?.width ?? Number.NaN, 0);

  await stepThrough(group, zoomOut, ["160%", "128%", "100%", "80%"]);
  await expect.poll(() => scrollWidth(page)).toBe(width);
  await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(0);
});

/**
 * Press down to 8% and up to 200%, from 20px above the page's end, where
 * the whole pill shows. Once the layout settles after each press, the pill
 * stays at its place, and no part that the zoom scales changes its own
 * height. On a desktop the Specs panel and the workspace share a row, and
 * at 9% and 8% the panel is taller than the scaled workspace, so it must
 * not stretch the workspace. There the page's content is also shorter than
 * the window, so the page grows to keep the pill in its place.
 */
async function pillKeepsItsPlace(page: Page): Promise<void> {
  await page.goto(SITE_PATHS.home);
  const { group, zoomIn, zoomOut } = zoomPill(page);
  await zoomOut.focus();
  await scrollAboveEnd(page, 20);
  const start = await settled(group);
  const presses: ReadonlyArray<readonly [Locator, string]> = [
    ...DOWN_TO_END.map((zoom) => [zoomOut, zoom] as const),
    ...UP_FROM_END.map((zoom) => [zoomIn, zoom] as const),
  ];
  for (const [button, zoom] of presses) {
    await stepThrough(group, button, [zoom]);
    const now = await settled(group);
    expect(now.heights, `at ${zoom}, the own heights`).toEqual(start.heights);
    expectNear(now.x, start.x, `at ${zoom}, the pill's left`);
    expectNear(now.y, start.y, `at ${zoom}, the pill's top`);
  }
}

test("after each press the zoom pill keeps its place in the window", async ({
  page,
}) => {
  await pillKeepsItsPlace(page);
});

// The desktop home's content gets shorter than a 900px window from 9%; the
// taller phone home does not.
test(
  "repeated clicks at one point press Zoom out down to 8%, also once the page is shorter than the window",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const { group, zoomOut } = zoomPill(page);
    // The reader stops 38px above the page's end, where the window shows
    // the upper part of the pill, and leaves the pointer on Zoom out.
    await scrollAboveEnd(page, 38);
    const start = await settled(group);
    const box = await zoomOut.boundingBox();
    if (box === null) throw new Error("Zoom out is not drawn");
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    for (const zoom of DOWN_TO_END) {
      await page.mouse.click(x, y);
      await expect(group).toHaveText(`−${zoom}+`);
      const now = await settled(group);
      expectNear(now.y, start.y, `at ${zoom}, the pill's top`);
    }
  },
);

test.describe("with reduced motion", () => {
  // Reduced motion gives every element of the site a 1ms transition. One on
  // the zoom would still ease the page's heights after a press, while the
  // island reads the pill's place.
  test("after each press the zoom pill keeps its place in the window, as nothing eases the zoom", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await pillKeepsItsPlace(page);
  });
});

test(
  "the heading layer's measured values give its own size at every zoom",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const { group, zoomIn, zoomOut } = zoomPill(page);
    const heading = page.getByRole("heading", { level: 1 });
    const selection = page.locator(".site-home-title-sel");
    const size = selection.locator(".site-sel-size");
    const badge = selection.locator(".site-sel-badge");
    const gap = page.locator(".site-home-hero-redline .site-redline-value");
    for (const [button, shown] of [
      [zoomIn, ["125%", "156%", "195%", "200%"]],
      [zoomOut, ["160%", "128%", "100%", "80%", "64%", "51%", "41%"]],
    ] as const) {
      await stepThrough(group, button, shown);
      // Playwright gives drawn boxes only; the heading's own size, before the
      // zoom, is its offset size.
      const own = await heading.evaluate(
        (element: HTMLElement) =>
          `${element.offsetWidth} × ${element.offsetHeight}`,
      );
      await expect(size).toHaveText(own);
      await expect(badge).toHaveText("Geist Semibold 162");
      await expect(gap).toHaveText("60");
    }
  },
);

test.describe("without script", () => {
  test("the home draws the depicted pill in the box of the control", async ({
    browser,
    page,
  }) => {
    await page.goto(SITE_PATHS.home);
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const control = zoomPill(page).group;
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: page.viewportSize(),
    });
    try {
      const plain = await context.newPage();
      await plain.goto(new URL(SITE_PATHS.home, page.url()).href);
      await expect(zoomPill(plain).group).toHaveCount(0);
      const footer = plain.getByRole("contentinfo");
      await expect(footer.getByRole("button")).toHaveCount(0);
      const depicted = footer.getByText("100%").filter({ visible: true });
      await depicted.scrollIntoViewIfNeeded();
      for (const side of ["x", "y", "width", "height"] as const)
        await expect
          .poll(async () => (await depicted.boundingBox())?.[side], side)
          .toBeCloseTo(box?.[side] ?? Number.NaN, 0);
    } finally {
      await context.close();
    }
  });
});
