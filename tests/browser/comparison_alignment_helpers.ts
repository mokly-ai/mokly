import { expect, type Locator, type Page } from "@playwright/test";

import { loadComparison } from "./comparison_actions.js";
import { chooseViewport } from "./workspace_actions.js";

/** One version of a comparison. */
export type Side = "after" | "before";

/** A two-dimensional scroll offset in CSS pixels. */
export interface Offset {
  x: number;
  y: number;
}

/**
 * Open an alignment route and load the requested comparison mode. Live Serve
 * waits for the selected comparison request; `static` delivery (an export or an
 * embedded viewer) reads its packaged comparison, so it only waits for panes.
 */
export async function openComparison(
  page: Page,
  url: string,
  viewport: "both" | "desktop" | "mobile",
  mode: "Difference" | "Overlay" | "Side by side",
  delivery: "live" | "static" = "live",
): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(url);
  await chooseViewport(page, viewport);
  const first = mode === "Difference" ? "Overlay" : mode;
  if (delivery === "live") await loadComparison(page, first);
  else await page.getByRole("button", { name: first, exact: true }).click();
  if (mode === "Difference")
    await page.getByRole("button", { name: "Difference", exact: true }).click();
  await expect(page.locator("[data-diff-stage] iframe").first()).toBeVisible();
}

/** The comparison section of one viewport. */
export function comparisonSection(
  page: Page,
  viewport: "desktop" | "mobile",
): Locator {
  return page.locator(`[data-diff-stage] [data-diff-viewport="${viewport}"]`);
}

/** The frame showing one version inside a comparison section. */
export function paneFrame(section: Locator, side: Side): Locator {
  return section.locator(`.mb-pane--${side} iframe`);
}

/** The user-scrollable shared viewports inside a comparison section. */
export function sharedViewports(section: Locator): Locator {
  return section.locator("[data-comparison-viewport]");
}

/** Read the scroll offset of the document shown by a pane frame. */
export function documentOffset(frame: Locator): Promise<Offset> {
  return frame
    .contentFrame()
    .locator("html")
    .evaluate((root) => {
      const scroller = root.ownerDocument.scrollingElement ?? root;
      return { x: scroller.scrollLeft, y: scroller.scrollTop };
    });
}

/** Read both versions' document offsets in one section. */
export async function layerOffsets(
  section: Locator,
): Promise<Record<Side, Offset>> {
  return {
    before: await documentOffset(paneFrame(section, "before")),
    after: await documentOffset(paneFrame(section, "after")),
  };
}

/** Read the scroll offset of a shared viewport. */
export function viewportOffset(viewport: Locator): Promise<Offset> {
  return viewport.evaluate((element) => ({
    x: element.scrollLeft,
    y: element.scrollTop,
  }));
}

/** Scroll with the wheel over the centre of a pane frame. */
export async function wheelOver(
  page: Page,
  target: Locator,
  deltaY: number,
  deltaX = 0,
): Promise<void> {
  await target.evaluate((element) =>
    element.closest(".mb-panes")?.scrollIntoView({ block: "nearest" }),
  );
  const box = await target.boundingBox();
  if (!box) throw new Error("The wheel target is not rendered");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(deltaX, deltaY);
}

/** Expect both stacked documents and the shared viewport at one offset. */
export async function expectStackAt(
  section: Locator,
  y: number,
): Promise<void> {
  await expect
    .poll(async () => {
      const offsets = await layerOffsets(section);
      return [offsets.before.y, offsets.after.y];
    })
    .toEqual([y, y]);
  await expect
    .poll(async () => (await viewportOffset(sharedViewports(section))).y)
    .toBe(y);
}

/** Expect the two layers of a stack to occupy one rectangle. */
export async function expectCoincidentLayers(section: Locator): Promise<void> {
  const before = await paneFrame(section, "before").boundingBox();
  const after = await paneFrame(section, "after").boundingBox();
  expect(before).not.toBeNull();
  expect(after).toEqual(before);
}

/** Read a document-space element's top edge in page coordinates. */
export async function pageTop(
  frame: Locator,
  selector: string,
): Promise<number> {
  const frameTop = await frame.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const inner = await frame
    .contentFrame()
    .locator(selector)
    .evaluate((element) => element.getBoundingClientRect().top);
  return frameTop + inner;
}

/** Read a pane document's visible height and its scroll range. */
export function documentExtent(
  frame: Locator,
): Promise<{ height: number; range: number }> {
  return frame
    .contentFrame()
    .locator("html")
    .evaluate((root) => {
      const scroller = root.ownerDocument.scrollingElement ?? root;
      return {
        height: scroller.clientHeight,
        range: scroller.scrollHeight - scroller.clientHeight,
      };
    });
}

/** Read one inline size of an element, such as a spacer's height. */
export function cssPixels(
  element: Locator,
  property: "height" | "width",
): Promise<number> {
  return element.evaluate(
    (node, name) => node.getBoundingClientRect()[name],
    property,
  );
}

/** Sample a value across several animation frames of the page. */
export async function sampleFrames<T>(
  page: Page,
  read: () => Promise<T>,
  frames = 8,
): Promise<T[]> {
  const samples: T[] = [];
  for (let index = 0; index < frames; index += 1) {
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
    samples.push(await read());
  }
  return samples;
}
