import { expect } from "@playwright/test";

import {
  expectPaneFrameAttributes,
  generationAddress,
} from "./comparison_frames.js";
import {
  comparisonSection,
  documentExtent,
  documentOffset,
  expectCoincidentLayers,
  expectStackAt,
  layerOffsets,
  openComparison,
  paneFrame,
  regionOffset,
  sharedViewports,
  viewportOffset,
  wheelOver,
  wheelOverRegion,
} from "./comparison_scroll.js";
import { comparisonPaths, test } from "./comparison_test.js";
import { comparisonIndex, modeButton } from "./comparison_ui.js";

const changed = comparisonPaths.changed;

test("Overlay and Difference scroll one desktop stack as one", async ({
  page,
  request,
  baseURL,
}) => {
  const index = await comparisonIndex(request, baseURL);
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await wheelOver(page, paneFrame(desktop, "after"), 400);
  await expectStackAt(desktop, 400);
  await expectCoincidentLayers(desktop);
  await expect(desktop.locator(".browser-frame")).toHaveCount(1);
  await expect(desktop.locator(".browser-expand")).toHaveCount(0);
  await expectPaneFrameAttributes(
    desktop,
    generationAddress(baseURL!, index.comparisonUrl),
    changed,
    "desktop",
  );

  await modeButton(page, "Difference").click();
  await expect(desktop.locator(".mb-panes")).toHaveAttribute(
    "data-compare-mode",
    "difference",
  );
  const start = (await viewportOffset(sharedViewports(desktop))).y;
  await wheelOver(page, paneFrame(desktop, "after"), 300);
  await expectStackAt(desktop, start + 300);
  await expectCoincidentLayers(desktop);
  await expect(desktop.locator(".mb-pane--after")).toHaveCSS(
    "mix-blend-mode",
    "difference",
  );
  await expect(desktop.locator(".browser-frame")).toHaveCSS(
    "mix-blend-mode",
    "normal",
  );
});

test("a mobile stack scrolls inside the phone screen", async ({ page }) => {
  await openComparison(page, changed, "mobile", "Overlay");
  const mobile = comparisonSection(page, "mobile");
  await wheelOver(page, paneFrame(mobile, "after"), 300);
  await expectStackAt(mobile, 300);
  await expectCoincidentLayers(mobile);
  await expect(mobile.locator(".phone-frame")).toHaveCount(1);
  const band = await mobile.locator(".phone-status").boundingBox();
  const viewport = await sharedViewports(mobile).boundingBox();
  expect(viewport!.y).toBeGreaterThanOrEqual(band!.y + band!.height);
});

test("both viewports keep one stack each", async ({ page }) => {
  await openComparison(page, changed, "both", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const mobile = comparisonSection(page, "mobile");
  await wheelOver(page, paneFrame(desktop, "after"), 400);
  await expectStackAt(desktop, 400);
  await expectStackAt(mobile, 0);
  await wheelOver(page, paneFrame(mobile, "after"), 200);
  await expectStackAt(mobile, 200);
  await expectStackAt(desktop, 400);
  await expectCoincidentLayers(mobile);
  await expectCoincidentLayers(desktop);
});

test("a component comparison scrolls inside its bordered frame", async ({
  page,
}) => {
  await openComparison(
    page,
    comparisonPaths.quietVariant,
    "desktop",
    "Overlay",
  );
  const desktop = comparisonSection(page, "desktop");
  await expect(desktop.locator(".mb-component-frame")).toHaveCount(1);
  await wheelOver(page, paneFrame(desktop, "after"), 200);
  await expectStackAt(desktop, 200);
  await expectCoincidentLayers(desktop);
});

test("a shorter document stays aligned past its own end", async ({ page }) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  const before = await documentExtent(paneFrame(desktop, "before"));
  const after = await documentExtent(paneFrame(desktop, "after"));
  // The fixture's Before page is the shorter one.
  expect(before.range).toBeLessThan(after.range);
  /** An element's top edge in page coordinates, in one version. */
  const pageTop = (side: "after" | "before", css: string) =>
    paneFrame(desktop, side).evaluate(
      (frame: HTMLIFrameElement, selector) =>
        frame.getBoundingClientRect().top +
        frame.contentDocument!.querySelector(selector)!.getBoundingClientRect()
          .top,
      css,
    );
  const expectAligned = async (offset: number) => {
    await expect
      .poll(async () => {
        const offsets = await layerOffsets(desktop);
        return [offsets.before.y, offsets.after.y];
      })
      .toEqual([Math.min(offset, before.range), offset]);
    expect((await viewportOffset(sharedViewports(desktop))).y).toBe(offset);
    // Content that both versions hold keeps one position on the page.
    for (const css of ["h1", "#panel"])
      expect(await pageTop("after", css), css).toBe(
        await pageTop("before", css),
      );
  };
  await wheelOver(page, paneFrame(desktop, "after"), 500);
  await expectAligned(500);
  await wheelOver(page, paneFrame(desktop, "after"), 5_000);
  await expectAligned(after.range);
  // Past its own end, the shorter version's surface keeps its own canvas
  // colour. After has a transparent canvas, so its surface shows only the
  // screen background.
  const canvas = {
    before: "linear-gradient(rgb(250, 240, 230), rgb(250, 240, 230))",
    after: "linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0))",
  };
  for (const side of ["before", "after"] as const) {
    const surface = desktop.locator(`.mb-pane--${side} .mb-pane-doc`);
    await expect(surface).toHaveCSS("background-image", canvas[side]);
    await expect(surface).toHaveCSS("background-color", "rgb(255, 255, 255)");
  }
});

test("an inner scroll region scrolls every version while the page stays", async ({
  page,
}) => {
  await openComparison(page, changed, "desktop", "Overlay");
  const desktop = comparisonSection(page, "desktop");
  await wheelOverRegion(page, paneFrame(desktop, "after"), "#panel", 200);
  for (const side of ["after", "before"] as const)
    await expect
      .poll(
        async () => (await regionOffset(paneFrame(desktop, side), "#panel")).y,
      )
      .toBe(200);
  for (const side of ["before", "after"] as const)
    expect(await documentOffset(paneFrame(desktop, side))).toEqual({
      x: 0,
      y: 0,
    });
  expect((await viewportOffset(sharedViewports(desktop))).y).toBe(0);
});
