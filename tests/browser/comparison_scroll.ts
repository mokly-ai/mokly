/**
 * Scroll checks for the comparison panes on the copied comparison output.
 * Pane documents are same-origin srcdoc frames, so reads go through the
 * parent page; settling waits on animation frames, never on a sleep.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { modeButton } from "./comparison_ui.js";
import { chooseViewport } from "./workspace_actions.js";

/** One version of a comparison. */
export type Side = "after" | "before";

/** A two-dimensional scroll offset in CSS pixels. */
export interface Offset {
  x: number;
  y: number;
}

/** Open one entry at a wide window and load a diff mode for a viewport. */
export async function openComparison(
  page: Page,
  entryPath: string,
  viewport: "both" | "desktop" | "mobile",
  mode: "Difference" | "Overlay" | "Side by side",
): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`/view/${entryPath}/`);
  await chooseViewport(page, viewport);
  await modeButton(page, mode).click();
  await expect(modeButton(page, mode)).toHaveAttribute("aria-pressed", "true");
  const frames = page.locator("[data-diff-stage] iframe");
  await expect(frames).toHaveCount(viewport === "both" ? 4 : 2);
  for (const frame of await frames.all())
    await expect(frame.contentFrame().locator("body")).not.toBeEmpty();
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
  return frame.evaluate((element: HTMLIFrameElement) => {
    const scroller = element.contentDocument!.scrollingElement!;
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

/** A pane document's visible height and its scroll range. */
export function documentExtent(
  frame: Locator,
): Promise<{ height: number; range: number }> {
  return frame.evaluate((element: HTMLIFrameElement) => {
    const scroller = element.contentDocument!.scrollingElement!;
    return {
      height: scroller.clientHeight,
      range: scroller.scrollHeight - scroller.clientHeight,
    };
  });
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

/** Read one region's offsets in both versions within one task of the page. */
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

/** Let a few rendering updates of the page pass. */
export async function passRenderingUpdates(page: Page): Promise<void> {
  for (let frames = 0; frames < 3; frames += 1)
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
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
  const stage = (await page.locator("[data-diff-stage]").boundingBox())!;
  let box = await region.boundingBox();
  if (!box) throw new Error(`The region ${selector} is not rendered`);
  const centre = box.y + box.height / 2;
  if (centre < stage.y + 40 || centre > stage.y + stage.height - 40) {
    await frame.evaluate(
      (element, delta) =>
        element.closest("[data-diff-stage]")?.scrollBy(0, delta),
      centre - (stage.y + stage.height / 2),
    );
    box = (await region.boundingBox())!;
  }
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

/** The Scroll together switch of the comparison band. */
export function scrollTogether(page: Page): Locator {
  return page.getByRole("switch", { name: "Scroll together" });
}

/** Mark every pane document so a later check can prove none reloaded. */
export async function markPaneDocuments(section: Locator): Promise<void> {
  for (const frame of await section.locator("iframe").all())
    await frame.evaluate((element: HTMLIFrameElement) => {
      element.contentDocument!.documentElement.dataset["probe"] = "kept";
    });
}

/** Expect every pane document marked earlier to be the same document. */
export async function expectPaneDocumentsKept(section: Locator): Promise<void> {
  for (const frame of await section.locator("iframe").all())
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) =>
          element.contentDocument?.documentElement.dataset["probe"],
      ),
    ).toBe("kept");
}
