/**
 * Page scroll checks for the comparison panes: each version's document
 * offset and range, each page viewport's offset, the wheel over a pane, and
 * marks that prove a pane document stayed. Pane documents are same-origin
 * `srcdoc` frames, so reads go through the parent page; settling waits on
 * animation frames, never on a sleep. Every offset, range and size here is in
 * the documents' CSS pixels, which the canvas zoom does not change.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  paneFrame,
  sharedViewports,
  type Side,
} from "./comparison_sections.js";

/** A two-dimensional scroll offset in CSS pixels. */
export interface Offset {
  x: number;
  y: number;
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

/** Read the scroll offset of a page viewport. */
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

/**
 * Scroll with the wheel over the centre of a pane frame, after bringing its
 * frame's document into view.
 */
export async function wheelOver(
  page: Page,
  target: Locator,
  deltaY: number,
  deltaX = 0,
): Promise<void> {
  await target.evaluate((element) =>
    element
      .closest("[data-compare-mode]")
      ?.scrollIntoView({ block: "nearest" }),
  );
  const box = await target.boundingBox();
  if (!box) throw new Error("The wheel target is not rendered");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(deltaX, deltaY);
}

/** Expect both stacked documents and the shared viewport of a stack at one offset. */
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

/** Read a value after each of several rendering updates of the page. */
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

/** Expect the two layers of a stack to occupy one rectangle. */
export async function expectCoincidentLayers(section: Locator): Promise<void> {
  const before = await paneFrame(section, "before").boundingBox();
  const after = await paneFrame(section, "after").boundingBox();
  expect(before).not.toBeNull();
  expect(after).toEqual(before);
}

/** The Scroll together switch of the comparison band. */
export function scrollTogether(page: Page): Locator {
  return page.getByRole("switch", { name: "Scroll together" });
}

/**
 * Mark every pane document of `scope`, a section or the stage, so a later
 * check can prove none reloaded. It fails when `scope` holds no pane frame,
 * so a scope that misses the panes cannot pass the later check unchecked.
 */
export async function markPaneDocuments(scope: Locator): Promise<void> {
  const frames = scope.locator("iframe[data-mokly-comparison-frame]");
  await expect(frames).not.toHaveCount(0);
  for (const frame of await frames.all())
    await frame.evaluate((element: HTMLIFrameElement) => {
      element.contentDocument!.documentElement.dataset["probe"] = "kept";
    });
}

/** Expect every pane document of `scope` that was marked earlier to be the same document. */
export async function expectPaneDocumentsKept(scope: Locator): Promise<void> {
  const frames = scope.locator("iframe[data-mokly-comparison-frame]");
  await expect(frames).not.toHaveCount(0);
  for (const frame of await frames.all())
    expect(
      await frame.evaluate(
        (element: HTMLIFrameElement) =>
          element.contentDocument?.documentElement.dataset["probe"],
      ),
    ).toBe("kept");
}
