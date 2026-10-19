/**
 * Page alignment cases with their own documents on the copied comparison
 * output, under the comparison panes contract. A viewport-height hero cannot
 * grow its comparison while a late image loads, fixed bars and sticky
 * headers stay on the viewport edges, and an app shell page that never
 * scrolls moves only its inner region in every version.
 */

import { expect, type Locator } from "@playwright/test";

import { LATE_IMAGE_HEIGHT } from "../helpers/comparison_scroll_groups.js";

import {
  comparisonSection,
  documentOffset,
  expectStackAt,
  openComparison,
  paneFrame,
  sampleFrames,
  sharedViewports,
  viewportOffset,
  wheelOver,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";

/** One computed length of an element, in CSS pixels. */
function cssPixels(locator: Locator, property: string): Promise<number> {
  return locator.evaluate(
    (element, name) =>
      Number.parseFloat(getComputedStyle(element).getPropertyValue(name)),
    property,
  );
}

/** The page-coordinate top of an element inside a pane frame. */
async function pageTop(frame: Locator, selector: string): Promise<number> {
  const box = (await frame.boundingBox())!;
  const top = await frame
    .contentFrame()
    .locator(selector)
    .evaluate((node) => node.getBoundingClientRect().top);
  return box.y + top;
}

test("a viewport-height hero cannot grow its comparison", async ({ page }) => {
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/snapshots/**/alignment-late.svg", async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  await openComparison(page, comparisonPaths.tall, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const spacer = desktop.locator("[data-comparison-spacer]");
  const frames = desktop.locator("iframe");
  const viewport = sharedViewports(desktop);
  const sizes = async () => ({
    spacer: await cssPixels(spacer, "height"),
    frames: await frames.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    ),
    viewport: await viewport.evaluate((element) => element.clientHeight),
  });
  await expect.poll(async () => (await sizes()).spacer).toBeGreaterThan(0);
  // While the image waits, no rendering update changes a size.
  const early = await sampleFrames(page, sizes);
  expect(new Set(early.map((sample) => JSON.stringify(sample))).size).toBe(1);
  expect(early[0]!.frames).toEqual([early[0]!.viewport, early[0]!.viewport]);

  release();
  await expect
    .poll(async () => (await sizes()).spacer)
    .toBe(early[0]!.spacer + LATE_IMAGE_HEIGHT);
  const late = await sampleFrames(page, sizes);
  expect(new Set(late.map((sample) => JSON.stringify(sample))).size).toBe(1);
  expect(late[0]!.frames).toEqual([late[0]!.viewport, late[0]!.viewport]);
});

test("fixed bars and sticky headers stay on the chrome viewport edges", async ({
  page,
}) => {
  await openComparison(page, comparisonPaths.tall, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await wheelOver(page, paneFrame(desktop, "after"), 900);
  await expectStackAt(desktop, 900);
  const viewport = sharedViewports(desktop);
  const top = (await viewport.boundingBox())!.y;
  const bottom = await viewport.evaluate(
    (element) => element.getBoundingClientRect().top + element.clientHeight,
  );
  for (const side of ["before", "after"] as const) {
    const frame = paneFrame(desktop, side);
    expect(await pageTop(frame, ".al-header")).toBe(top);
    const bar = await frame
      .contentFrame()
      .locator(".al-bar")
      .evaluate((node) => ({
        bottom: node.getBoundingClientRect().bottom,
        inner: node.ownerDocument.defaultView!.innerHeight,
      }));
    expect(bar.bottom).toBe(bar.inner);
    expect((await pageTop(frame, ".al-bar")) + 40).toBe(bottom);
  }
});

test("an inner scroll region scrolls every version while an app shell page stays", async ({
  page,
}) => {
  await openComparison(page, comparisonPaths.appShell, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await expect
    .poll(() =>
      cssPixels(desktop.locator("[data-comparison-spacer]"), "height"),
    )
    .toBe(0);
  await wheelOver(page, paneFrame(desktop, "after"), 300);
  const inner = (side: "after" | "before") =>
    paneFrame(desktop, side)
      .contentFrame()
      .locator("#al-inner")
      .evaluate((node) => node.scrollTop);
  await expect.poll(() => inner("after")).toBe(300);
  await expect.poll(() => inner("before")).toBe(300);
  for (const side of ["before", "after"] as const)
    expect(await documentOffset(paneFrame(desktop, side))).toEqual({
      x: 0,
      y: 0,
    });
  expect((await viewportOffset(sharedViewports(desktop))).y).toBe(0);
});
