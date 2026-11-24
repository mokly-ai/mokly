import { type Locator, type Page, expect } from "@playwright/test";

/**
 * The home's zoom pill in a browser spec: its group and buttons, a run of
 * presses, and the places that a spec compares before and after a zoom.
 * `home-zoom.spec.ts` and `home-zoom-scale.spec.ts` share them.
 */

/** Runs a test in the desktop projects only. */
export const DESKTOP = { tag: "@desktop" };

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

/** The page's width without its scrollbar, which a zoom never changes. */
export function windowWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.clientWidth);
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
