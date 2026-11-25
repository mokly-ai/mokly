/**
 * The footer frame of the home's zoomed-in drawing, as the disk smoke checks
 * it. The drawing scales the frame with CSS zoom and gives it a width rule
 * of its own, which `design-site-parity-home.ts` lets differ from the site's
 * rule, so the smoke compares what the browser draws: at 200% the frame is
 * twice as wide as the home's frame at 100% in the same window, and twice as
 * far from the page's start. Each window holds one composition's width
 * rule: 390px the phone's, and 1280px the desktop step's below 1440px.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { type Page, expect } from "@playwright/test";

import { outputRoot, screenView, type Viewport } from "./catalogue-paths";

/** The windows that each hold one composition's width rule of the frame. */
export const FRAME_WINDOWS: ReadonlyArray<readonly [Viewport, number]> = [
  ["mobile", 390],
  ["desktop", 1280],
];

/** The home at 100% and its zoomed-in state at 200%. */
const HOME = "design/site/home";
const ZOOMED_IN = "design/site/home/zoomed-in";

/** The footer frame's drawn width and its offset from the page's start. */
interface Frame {
  readonly start: number;
  readonly width: number;
}

/** Open the light document of `path` in `viewport` and read its footer frame. */
async function footerFrame(
  page: Page,
  path: string,
  viewport: Viewport,
): Promise<Frame> {
  const file = resolve(outputRoot, screenView(path, viewport, "light"));
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  // The frame depicts a design frame, which has no role.
  return page.locator(".site-footer-inner").evaluate((frame) => {
    const box = frame.getBoundingClientRect();
    return { start: box.left + window.scrollX, width: box.width };
  });
}

/**
 * Expect the zoomed-in home's footer frame, in a window `width` pixels wide
 * that shows `viewport`, at twice the width and twice the offset of the
 * home's frame at 100% there, within a pixel. Both documents lay out in the
 * same page width, the window without its scrollbar.
 */
export async function expectFooterFrameScaled(
  page: Page,
  viewport: Viewport,
  width: number,
): Promise<void> {
  await page.setViewportSize({ height: 900, width });
  const home = await footerFrame(page, HOME, viewport);
  const zoomed = await footerFrame(page, ZOOMED_IN, viewport);
  for (const side of ["start", "width"] as const)
    expect(
      Math.abs(zoomed[side] - 2 * home[side]),
      `${viewport} at ${width}px, the frame's ${side}: ${zoomed[side]} against twice ${home[side]}`,
    ).toBeLessThanOrEqual(1);
}
