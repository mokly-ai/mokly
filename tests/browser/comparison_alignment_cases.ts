/**
 * Comparison alignment checks shared by every delivery that serves native
 * comparisons: the copied comparison output and Serve's selected comparisons.
 * The pane contract names both, so one set of assertions runs on each host.
 */

import { expect } from "@playwright/test";

import { comparisonPaths } from "../helpers/comparison_catalogue.js";

import { test as baseTest } from "./browser_test.js";
import {
  expectPaneFrameAttributes,
  generationAddress,
} from "./comparison_frames.js";
import { regionOffset, wheelOverRegion } from "./comparison_region_offsets.js";
import {
  documentExtent,
  documentOffset,
  expectCoincidentLayers,
  expectStackAt,
  layerOffsets,
  viewportOffset,
  wheelOver,
} from "./comparison_scroll.js";
import {
  comparisonSection,
  frameLabels,
  frameModes,
  openComparison,
  paneFrame,
  sharedViewports,
} from "./comparison_sections.js";
import { modeButton } from "./comparison_ui.js";

/** Register the alignment cases on the host that `test` supplies as its base URL. */
export function registerComparisonAlignment(test = baseTest): void {
  const changed = comparisonPaths.changed;

  test("Overlay and Difference scroll one desktop stack as one", async ({
    page,
  }) => {
    const [accepted] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.ok() &&
          /\/diffs\/generations\/[^/]+\/snapshots\/.+\.html$/u.test(
            response.url(),
          ),
      ),
      openComparison(page, changed, "desktop", "Overlay"),
    ]);
    const desktop = comparisonSection(page, "desktop");
    await wheelOver(page, paneFrame(desktop, "after"), 400);
    await expectStackAt(desktop, 400);
    await expectCoincidentLayers(desktop);
    // One bare canvas frame at its nominal size holds the stack, with no
    // control of its own, so one version cannot be expanded alone.
    await expect(frameLabels(desktop)).toHaveText([
      /^Desktop · Light\s*1280 × 800$/u,
    ]);
    await expect(desktop.getByRole("button")).toHaveCount(0);
    await expectPaneFrameAttributes(
      desktop,
      generationAddress(new URL(accepted.url()).origin, accepted.url()),
      changed,
      "desktop",
    );

    await modeButton(page, "Difference").click();
    await expect(frameModes(desktop)).toHaveAttribute(
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
    // The frame itself is never blended.
    await expect(desktop).toHaveCSS("mix-blend-mode", "normal");
  });

  test("a mobile stack scrolls inside its mobile frame", async ({ page }) => {
    await openComparison(page, changed, "mobile", "Overlay");
    const mobile = comparisonSection(page, "mobile");
    await wheelOver(page, paneFrame(mobile, "after"), 300);
    await expectStackAt(mobile, 300);
    await expectCoincidentLayers(mobile);
    await expect(frameLabels(mobile)).toHaveText([
      /^Mobile · Light\s*390 × 844$/u,
    ]);
    // Each version lays out at the frame's nominal size, whatever the zoom.
    for (const side of ["before", "after"] as const)
      expect(
        await paneFrame(mobile, side).evaluate((frame: HTMLIFrameElement) => [
          frame.contentWindow!.innerWidth,
          frame.contentWindow!.innerHeight,
        ]),
        side,
      ).toEqual([390, 844]);
  });

  test("each frame keeps its own stack", async ({ page }) => {
    await openComparison(page, changed, "both", "Overlay");
    const desktop = comparisonSection(page, "desktop");
    const mobile = comparisonSection(page, "mobile");
    const darkDesktop = comparisonSection(page, "desktop", "dark");
    const darkMobile = comparisonSection(page, "mobile", "dark");
    await wheelOver(page, paneFrame(desktop, "after"), 400);
    await expectStackAt(desktop, 400);
    await expectStackAt(mobile, 0);
    await expectStackAt(darkDesktop, 0);
    await wheelOver(page, paneFrame(mobile, "after"), 200);
    await expectStackAt(mobile, 200);
    await expectStackAt(desktop, 400);
    await expectStackAt(darkMobile, 0);
    await expectCoincidentLayers(mobile);
    await expectCoincidentLayers(desktop);
  });

  test("a component comparison stacks both versions in one frame that fits them", async ({
    page,
  }) => {
    await openComparison(
      page,
      comparisonPaths.quietVariant,
      "desktop",
      "Overlay",
    );
    const component = comparisonSection(page, "component");
    await expect(frameLabels(component)).toHaveText([/^Bold · Light/u]);
    // The frame takes the larger size of its two versions, so neither
    // version has a page range, and the wheel leaves the stack at its start.
    for (const side of ["before", "after"] as const)
      await expect
        .poll(
          async () => (await documentExtent(paneFrame(component, side))).range,
          side,
        )
        .toBe(0);
    await wheelOver(page, paneFrame(component, "after"), 200);
    await expectStackAt(component, 0);
    await expectCoincidentLayers(component);
  });

  test("a shorter document stays aligned past its own end", async ({
    page,
  }) => {
    await openComparison(page, changed, "desktop", "Overlay");
    const desktop = comparisonSection(page, "desktop");
    const before = await documentExtent(paneFrame(desktop, "before"));
    const after = await documentExtent(paneFrame(desktop, "after"));
    // The fixture's Before page is the shorter one.
    expect(before.range).toBeLessThan(after.range);
    /**
     * An element's top edge on the page, in one version: its frame's drawn
     * top plus its top in the document, which the canvas zoom scales.
     */
    const pageTop = (side: "after" | "before", css: string) =>
      paneFrame(desktop, side).evaluate(
        (frame: HTMLIFrameElement, selector) => {
          const box = frame.getBoundingClientRect();
          const zoom = box.height / frame.offsetHeight;
          const node = frame.contentDocument!.querySelector(selector)!;
          return box.top + node.getBoundingClientRect().top * zoom;
        },
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
      // Content that both versions hold keeps one position on the page. The
      // zoom's scale leaves a rounding error far below a millionth of a pixel.
      for (const css of ["h1", "#panel"])
        expect(await pageTop("after", css), css).toBeCloseTo(
          await pageTop("before", css),
          6,
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
          async () =>
            (await regionOffset(paneFrame(desktop, side), "#panel")).y,
        )
        .toBe(200);
    for (const side of ["before", "after"] as const)
      expect(await documentOffset(paneFrame(desktop, side))).toEqual({
        x: 0,
        y: 0,
      });
    expect((await viewportOffset(sharedViewports(desktop))).y).toBe(0);
  });
}
