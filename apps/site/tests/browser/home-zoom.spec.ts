import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import { scrollWidth } from "./large-text.js";

/**
 * The home's zoom pill in a real browser, as the Home zoom section of
 * docs/protocol/cloud/site-chrome.md and the Zoom of
 * docs/protocol/cloud/site-design-pages.md fix it: the group and its
 * buttons, the steps from 8% to 200%, a button at its end that keeps focus,
 * the sideways scroll above 100% with the bars in place, the pill's place
 * after each press, the Specs panel and the measured values at every zoom,
 * and the depicted pill without script. `tests/home_zoom.test.ts` and
 * `tests/home_zoom_island.test.ts` check the steps and the island's
 * decisions against a stub page.
 */

/** Runs a test in the desktop projects only. */
const DESKTOP = { tag: "@desktop" };

/** The zoom pill of the home's status bar and its two buttons. */
function zoomPill(page: Page): Record<"group" | "zoomIn" | "zoomOut", Locator> {
  const group = page.getByRole("group", { name: "Zoom" });
  return {
    group,
    zoomIn: group.getByRole("button", { name: "Zoom in" }),
    zoomOut: group.getByRole("button", { name: "Zoom out" }),
  };
}

/** Press `button` from the keyboard once for each zoom of `shown`. */
async function stepThrough(
  pill: Locator,
  button: Locator,
  shown: readonly string[],
): Promise<void> {
  for (const zoom of shown) {
    await button.press("Enter");
    await expect(pill).toHaveText(`−${zoom}+`);
  }
}

/** The page's width without its scrollbar, which a zoom never changes. */
function windowWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.clientWidth);
}

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

test("after each press the zoom pill keeps its place in the window", async ({
  page,
}) => {
  await page.goto(SITE_PATHS.home);
  const { group, zoomIn, zoomOut } = zoomPill(page);
  await zoomOut.focus();
  const place = (await group.boundingBox())?.y ?? Number.NaN;
  const presses: ReadonlyArray<readonly [Locator, string]> = [
    ...["80%", "64%", "51%", "41%"].map((zoom) => [zoomOut, zoom] as const),
    ...["51%", "64%", "80%", "100%", "125%", "156%", "195%", "200%"].map(
      (zoom) => [zoomIn, zoom] as const,
    ),
  ];
  for (const [button, zoom] of presses) {
    await stepThrough(group, button, [zoom]);
    const top = (await group.boundingBox())?.y ?? Number.NaN;
    expect(Math.abs(top - place), `at ${zoom}`).toBeLessThanOrEqual(1);
  }
});

test(
  "the Specs panel sticks below the tool bar at every zoom",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const { group, zoomIn, zoomOut } = zoomPill(page);
    const specs = page.getByRole("navigation", { name: "Page sections" });
    const review = page.getByRole("article", { name: "Sticky comments." });
    const steps: ReadonlyArray<readonly [Locator, readonly string[]]> = [
      [zoomOut, []],
      [zoomOut, ["80%", "64%", "51%", "41%"]],
      [zoomIn, ["51%", "64%", "80%", "100%", "125%", "156%", "195%", "200%"]],
    ];
    for (const [button, shown] of steps) {
      await stepThrough(group, button, shown);
      // The reader scrolls back to the Review module, mid-way down the frames.
      await review.scrollIntoViewIfNeeded();
      await expect
        .poll(
          async () => (await specs.boundingBox())?.y,
          shown.at(-1) ?? "100%",
        )
        .toBeCloseTo(72, 0);
    }
  },
);

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
