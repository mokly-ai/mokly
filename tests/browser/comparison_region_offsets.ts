/**
 * Inner scroll regions of the comparison panes: each version's offset and
 * range of one region, waits until the versions settle, and the wheel over a
 * region. A region is named by a selector inside the pane documents, which
 * are same-origin `srcdoc` frames, so reads go through the parent page;
 * settling waits on animation frames, never on a sleep.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import type { Offset } from "./comparison_scroll.js";
import type { Side } from "./comparison_sections.js";
import { passRenderingUpdates } from "./page_settling.js";

/** Read one region's scroll offset inside a pane frame. */
export function regionOffset(
  frame: Locator,
  selector: string,
): Promise<Offset> {
  return frame.evaluate((element: HTMLIFrameElement, css) => {
    const node = element.contentDocument!.querySelector(css)!;
    return { x: node.scrollLeft, y: node.scrollTop };
  }, selector);
}

/** One region's vertical scroll range in one version. */
export function regionRange(frame: Locator, selector: string): Promise<number> {
  return frame.evaluate((element: HTMLIFrameElement, css) => {
    const node = element.contentDocument!.querySelector(css)!;
    return node.scrollHeight - node.clientHeight;
  }, selector);
}

/** Read one region's offsets in both versions of a section within one task of the page. */
export function regionOffsets(
  section: Locator,
  selector: string,
): Promise<Record<Side, Offset>> {
  return section.evaluate((element, css) => {
    const read = (side: Side): Offset => {
      const frame = element.querySelector<HTMLIFrameElement>(
        `.mb-pane--${side} iframe`,
      );
      const region = frame?.contentDocument?.querySelector(css);
      if (!region) throw new Error(`No ${css} in the ${side} pane`);
      return { x: region.scrollLeft, y: region.scrollTop };
    };
    return { before: read("before"), after: read("after") };
  }, selector);
}

/** Expect a region's offsets, `[before, after]`, to settle. */
export async function expectRegionsAt(
  section: Locator,
  selector: string,
  expected: [number, number],
  axis: keyof Offset = "y",
): Promise<void> {
  await expect
    .poll(async () => {
      const offsets = await regionOffsets(section, selector);
      return [offsets.before[axis], offsets.after[axis]];
    })
    .toEqual(expected);
}

/**
 * Wait until both versions of a region agree on an offset that `accept`
 * allows and keep it while a few rendering updates pass, then return it.
 */
export async function expectRegionsAtRest(
  section: Locator,
  selector: string,
  accept: (offset: number) => boolean,
  message?: string,
): Promise<number> {
  let reached = 0;
  await expect
    .poll(async () => {
      const offsets = await regionOffsets(section, selector);
      reached = offsets.after.y;
      if (offsets.before.y !== reached || !accept(reached)) return false;
      await passRenderingUpdates(section.page());
      const later = await regionOffsets(section, selector);
      return later.before.y === reached && later.after.y === reached;
    }, message)
    .toBe(true);
  return reached;
}

/** Wheel over the centre of one region inside a pane frame. */
export async function wheelOverRegion(
  page: Page,
  frame: Locator,
  selector: string,
  deltaY: number,
  deltaX = 0,
): Promise<void> {
  const region = frame.contentFrame().locator(selector);
  const box = await region.boundingBox();
  if (!box) throw new Error(`The region ${selector} is not rendered`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(deltaX, deltaY);
}

/** Wait until a region reaches an offset, then let rendering updates pass. */
export async function settleRegion(
  page: Page,
  frame: Locator,
  selector: string,
  y: number,
): Promise<void> {
  await expect
    .poll(async () => (await regionOffset(frame, selector)).y)
    .toBe(y);
  await passRenderingUpdates(page);
}
