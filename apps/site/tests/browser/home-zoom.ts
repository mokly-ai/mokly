import { type Locator, type Page, expect } from "@playwright/test";

import { PART } from "../../src/components/home/zoom-marks.js";

/**
 * The home's zoom pill in a browser spec: its group and buttons, a run of
 * presses, the layout once it settles after a press, the reader's place
 * above the page's end, and the places that a spec compares before and
 * after a zoom. `home-zoom.spec.ts`, `home-zoom-scale.spec.ts` and
 * `home-zoom-scrollbar.spec.ts` share them.
 */

/** Runs a test in the desktop projects only. */
export const DESKTOP = { tag: "@desktop" };

/** The zooms that Zoom out shows from 100% to 8%, its end. */
export const DOWN_TO_END = [
  ...["80%", "64%", "51%", "41%", "33%", "26%"],
  ...["21%", "17%", "13%", "11%", "9%", "8%"],
];

/** The zooms that Zoom in shows from 8% to 200%, its end. */
export const UP_FROM_END = [
  ...["10%", "13%", "16%", "20%", "24%", "31%", "38%", "48%"],
  ...["60%", "75%", "100%", "125%", "156%", "195%", "200%"],
];

/** The zoom pill of the home's status bar and its two buttons. */
export function zoomPill(
  page: Page,
): Record<"group" | "zoomIn" | "zoomOut", Locator> {
  const group = page.getByRole("group", { name: "Zoom" });
  return {
    group,
    zoomIn: group.getByRole("button", { name: "Zoom in" }),
    zoomOut: group.getByRole("button", { name: "Zoom out" }),
  };
}

/** Press `button` from the keyboard once for each zoom of `shown`. */
export async function stepThrough(
  pill: Locator,
  button: Locator,
  shown: readonly string[],
): Promise<void> {
  for (const zoom of shown) {
    await button.press("Enter");
    await expect(pill).toHaveText(`−${zoom}+`);
  }
}

/**
 * The pill's place in the window and the own height of each part that the
 * zoom scales, the hero, the workspace and the footer frame, in the order of
 * the page. An own height is the computed height, which no scale changes.
 */
export interface Settled {
  readonly heights: readonly number[];
  readonly x: number;
  readonly y: number;
}

/**
 * The pill's place and the parts' own heights once the home's layout
 * settles after a press. When a part's own height changes, a resize
 * observer sets the height that the part takes again, one animation frame
 * later, which can move the pill after the island put it in its place. So
 * the layout has settled when both read the same at the start of two
 * animation frames in a row, with that frame's resize observers between
 * the two reads. The computed height keeps the fractions of a pixel by
 * which such a change ends.
 */
export function settled(pill: Locator): Promise<Settled> {
  return pill.evaluate(async (element, mark) => {
    const read = () => {
      const { x, y } = element.getBoundingClientRect();
      const parts = [...document.querySelectorAll(`[${mark}]`)];
      const heights = parts.map((part) =>
        Number.parseFloat(getComputedStyle(part).height),
      );
      return { heights, x, y };
    };
    const frame = () =>
      new Promise<ReturnType<typeof read>>((resolve) => {
        requestAnimationFrame(() => resolve(read()));
      });
    let last = await frame();
    for (;;) {
      const now = await frame();
      if (JSON.stringify(now) === JSON.stringify(last)) return now;
      last = now;
    }
  }, PART);
}

/** The page's width without its scrollbar, which a zoom never changes. */
export function windowWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.clientWidth);
}

/**
 * Arrange the reader `above` CSS pixels above the page's end. A wheel
 * scrolls by the browser's own step, so the spec sets the exact place.
 */
export async function scrollAboveEnd(page: Page, above: number): Promise<void> {
  await page.evaluate((rest) => {
    const root = document.documentElement;
    window.scrollTo(0, root.scrollHeight - root.clientHeight - rest);
  }, above);
}

/**
 * A part as the page lays it out and draws it: its own size, which no
 * scale changes, and its drawn box in page coordinates, which a scroll does
 * not move.
 */
export interface Placed {
  readonly height: number;
  readonly own: readonly [number, number];
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Where `part` lies. Playwright gives a drawn box only, so the own size
 * comes from the element's offset size.
 */
export function placed(part: Locator): Promise<Placed> {
  return part.evaluate((element: HTMLElement) => {
    const box = element.getBoundingClientRect();
    return {
      height: box.height,
      own: [element.offsetWidth, element.offsetHeight] as const,
      width: box.width,
      x: box.left + window.scrollX,
      y: box.top + window.scrollY,
    };
  });
}

/** The page's scroll height, which ends where its content ends. */
export function pageHeight(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollHeight);
}

/** Expect `got` within a pixel of `want`, a drawn length or place. */
export function expectNear(got: number, want: number, label: string): void {
  expect(
    Math.abs(got - want),
    `${label}: ${got} against ${want}`,
  ).toBeLessThanOrEqual(1);
}
