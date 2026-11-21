import { type Locator, type Page, expect } from "@playwright/test";

/**
 * The parts of the HTML sample band of the Your first screen guide, and the
 * measures that `docs-sample.spec.ts` reads from them. The band, its lines,
 * its mark and its wire have no role, so these find them by their parts'
 * class names, and each view's frame by its title.
 */

export const SAMPLE_PAGE = "/docs/start/your-first-screen/";

/** Each view's frame title: the screen, the viewport and the saved state. */
export const VIEWS = {
  desktop: "Welcome, Desktop, Welcome",
  desktopFirstVisit: "Welcome, Desktop, First visit",
  mobile: "Welcome, Mobile, Welcome",
  mobileFirstVisit: "Welcome, Mobile, First visit",
} as const;

export interface Box {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function band(page: Page): Locator {
  return page.locator(".site-docs-sample");
}

/** One view's frame. */
export function view(page: Page, title: string): Locator {
  return page.getByTitle(title, { exact: true });
}

/** The segment of one option of the controls, which the reader presses. */
export function option(page: Page, name: string): Locator {
  return band(page).locator("label", {
    has: page.getByRole("radio", { exact: true, name }),
  });
}

/** One line of the sample's code, by its source. */
export function line(page: Page, source: string): Locator {
  return band(page).getByText(source, { exact: true });
}

/** The mark of the lit element in the frame that shows. */
export function mark(page: Page): Locator {
  return band(page).locator(".site-docs-sample-mark").filter({ visible: true });
}

export function wire(page: Page): Locator {
  return band(page).locator(".site-docs-sample-wire");
}

/** The parts of the wire that show: its curve and the dots at its ends. */
export function shownWire(page: Page): Locator {
  return wire(page)
    .locator("svg, .site-docs-sample-end")
    .filter({ visible: true });
}

/** The lit lines, by number: each takes a tint behind its code. */
export function litLines(page: Page): Promise<number[]> {
  return band(page)
    .locator(".site-code-line")
    .evaluateAll((lines) =>
      lines.flatMap((code, index) =>
        getComputedStyle(code).backgroundColor === "rgba(0, 0, 0, 0)"
          ? []
          : [index + 1],
      ),
    );
}

/**
 * The dimmed lines, by number: each takes the panel's muted text, which is
 * the colour of the line numbers.
 */
export function dimmedLines(page: Page): Promise<number[]> {
  return band(page)
    .locator(".site-code-line")
    .evaluateAll((lines) => {
      const muted = lines[0] && getComputedStyle(lines[0], "::before").color;
      return lines.flatMap((code, index) =>
        getComputedStyle(code).color === muted ? [index + 1] : [],
      );
    });
}

/** The box of a part that draws one. */
export async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error("the part draws no box");
  return found;
}

export function centre({ height, width, x, y }: Box): Point {
  return { x: x + width / 2, y: y + height / 2 };
}

/** Two points meet within a pixel. */
export function expectMeet(actual: Point, expected: Point, name: string): void {
  expect(Math.abs(actual.x - expected.x), `${name}: x`).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.y - expected.y), `${name}: y`).toBeLessThanOrEqual(1);
}

/** One box lies inside another, to the half pixel. */
export function expectInside(inner: Box, outer: Box, name: string): void {
  expect(inner.x, `${name}: left`).toBeGreaterThanOrEqual(outer.x - 0.5);
  expect(inner.y, `${name}: top`).toBeGreaterThanOrEqual(outer.y - 0.5);
  expect(inner.x + inner.width, `${name}: right`).toBeLessThanOrEqual(
    outer.x + outer.width + 0.5,
  );
  expect(inner.y + inner.height, `${name}: bottom`).toBeLessThanOrEqual(
    outer.y + outer.height + 0.5,
  );
}
