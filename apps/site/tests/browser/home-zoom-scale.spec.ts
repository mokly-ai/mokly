import { type Locator, type Page, expect, test } from "@playwright/test";

import { SITE_PATHS } from "../../src/navigation.js";

import {
  DESKTOP,
  type Placed,
  expectNear,
  pageHeight,
  placed,
  stepThrough,
  windowWidth,
  zoomPill,
} from "./home-zoom.js";
import { scrollWidth } from "./large-text.js";

/**
 * The home at a zoom of its zoom pill in a real browser, as the Zoom of
 * docs/protocol/cloud/site-design-pages.md fixes it: at every zoom the home
 * keeps its layout of 100% and the zoom only scales it, its text and the
 * page's height included, about the window's centre below 100% and from the
 * page's start above it; the Specs panel keeps its size and its place,
 * leads to its sections and marks the section in view; and above 100% a
 * focused part at a side scrolls into view. `home-zoom.spec.ts` checks the
 * pill itself.
 */

/** The zooms that a spec reaches, with the presses that reach them. */
const ZOOM_OUT = ["80%", "64%", "51%", "41%"];
const ZOOM_IN = ["51%", "64%", "80%", "100%", "125%", "156%", "195%", "200%"];

/** The parts that a spec follows through a zoom, inside `main`. */
function mainParts(page: Page): Readonly<Record<string, Locator>> {
  return {
    features: page.getByRole("heading", { name: /^Browse, review, edit\./ }),
    heading: page.getByRole("heading", { level: 1 }),
    lead: page.getByText("Generate an interactive mockup"),
    // The spread is a depiction, hidden from assistive technology, so its
    // first section box, where its artboards start, has no role.
    spread: page.locator(".site-home-spread-specs"),
  };
}

/** Where each of `parts` lies. */
async function placeAll(
  parts: Readonly<Record<string, Locator>>,
): Promise<Record<string, Placed>> {
  const found: Record<string, Placed> = {};
  for (const [name, part] of Object.entries(parts))
    found[name] = await placed(part);
  return found;
}

/**
 * Zoom the home out to 41% and in to 200%, and expect each part to keep its
 * own size and to lie where the zoom of its layout of 100% puts it, and the
 * page to end where the scaled content ends.
 */
async function expectScaled(page: Page): Promise<void> {
  await page.goto(SITE_PATHS.home);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const { group, zoomIn, zoomOut } = zoomPill(page);
  const parts = mainParts(page);
  // The footer frame is a depiction of a frame, which has no role.
  const frame = page.locator(".site-footer-inner");
  const width = await windowWidth(page);
  const main = await placed(page.getByRole("main"));
  const before = await placeAll(parts);
  const frameBefore = await placed(frame);
  const heightBefore = await pageHeight(page);
  for (const [button, shown, zoom] of [
    [zoomOut, ZOOM_OUT, 0.4096],
    [zoomIn, ZOOM_IN, 2],
  ] as const) {
    await stepThrough(group, button, shown);
    const after = await placeAll(parts);
    for (const [name, part] of Object.entries(before)) {
      const now = after[name];
      if (now === undefined) throw new Error(`${name} is gone`);
      const label = `${name} at ${shown.at(-1)}`;
      expect(now.own, `${label}: nothing reflows`).toEqual(part.own);
      // Text scales with its box in every engine.
      expectNear(now.width, part.width * zoom, `${label}, width`);
      expectNear(now.height, part.height * zoom, `${label}, height`);
      // Below 100% the zoom keeps the window's centre, and above 100% it
      // grows the content from the page's start.
      const x =
        zoom < 1 ? width / 2 + zoom * (part.x - width / 2) : zoom * part.x;
      expectNear(now.x, x, `${label}, left`);
      expectNear(now.y, main.y + zoom * (part.y - main.y), `${label}, top`);
    }
    const frameNow = await placed(frame);
    expectNear(frameNow.width, frameBefore.width * zoom, "frame, width");
    expectNear(
      await pageHeight(page),
      heightBefore - (1 - zoom) * (main.height + frameBefore.height),
      `page at ${shown.at(-1)}: it ends where the scaled content ends`,
    );
  }
}

test("at every zoom the home keeps its layout of 100%, and the zoom only scales it", async ({
  page,
}) => {
  await expectScaled(page);
});

test(
  "at 1280px the zoomed-out spread and copy sit at the centre of the window",
  DESKTOP,
  async ({ page }) => {
    // Below 1440px the spread starts at the window's gutter, as the copy
    // does not, so a layout in a wider room would leave the spread aside.
    await page.setViewportSize({ height: 900, width: 1280 });
    await expectScaled(page);
  },
);

test(
  "the Specs panel keeps its size and its place at every zoom, and marks the section in view",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const { group, zoomIn, zoomOut } = zoomPill(page);
    const specs = page.getByRole("navigation", { name: "Page sections" });
    const row = specs.getByRole("link", { exact: true, name: "02 Review" });
    const review = page.getByRole("article", { name: "Sticky comments." });
    const width = await windowWidth(page);
    // The reader follows the panel's own row to the Review module.
    const toReview = async () => {
      await row.click();
      await expect(review).toBeInViewport();
    };
    await toReview();
    await expect(row).toHaveAttribute("aria-current", "location");
    const rest = await specs.boundingBox();
    expect(rest?.y).toBeCloseTo(72, 0);
    const expectInPlace = async (at: string) => {
      for (const side of ["x", "y", "width", "height"] as const)
        await expect
          .poll(
            async () => (await specs.boundingBox())?.[side],
            `${at}, ${side}`,
          )
          .toBeCloseTo(rest?.[side] ?? Number.NaN, 0);
    };
    for (const [button, shown] of [
      [zoomOut, ZOOM_OUT],
      [zoomIn, ZOOM_IN],
    ] as const)
      for (const zoom of shown) {
        await stepThrough(group, button, [zoom]);
        await toReview();
        await expectInPlace(zoom);
        await expect(row, zoom).toHaveAttribute("aria-current", "location");
      }
    // At 200% the reader scrolls to the page's right end, over the panel.
    await page.mouse.move(width / 2, 450);
    await page.mouse.wheel(2 * width, 0);
    await expect.poll(() => page.evaluate(() => window.scrollX)).toBe(width);
    await expectInPlace("200% at the right end");
  },
);

test(
  "above 100% a focused part at the window's side scrolls into view",
  DESKTOP,
  async ({ page }) => {
    await page.goto(SITE_PATHS.home);
    const { group, zoomIn } = zoomPill(page);
    await stepThrough(group, zoomIn, ["125%", "156%", "195%", "200%"]);
    const width = await windowWidth(page);
    await expect.poll(() => scrollWidth(page)).toBe(2 * width);
    // Arrange the reader at the page's start, where the open foundation's
    // GitHub link lies below the window and past its right side.
    await page.evaluate(() => window.scrollTo(0, 0));
    const github = page.getByRole("link", { name: "View on GitHub" });
    await expect(github).not.toBeInViewport();
    await github.focus();
    await expect(github).toBeInViewport({ ratio: 1 });
  },
);
