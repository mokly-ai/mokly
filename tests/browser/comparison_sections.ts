/**
 * The compared frames of the canvas, on the copied comparison output, Serve
 * and an embedded viewer. In Overlay, Difference and Swipe every shown frame
 * compares its own view: its figure stacks both versions in one shared
 * viewport. Side by side compares one frame, the first shown frame, as a pair
 * of figures, Before and Current, each with its own viewport. A section is
 * what holds one compared frame's versions, and every reader of a version or
 * a viewport takes a section.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import {
  chooseMode,
  comparisonFrames,
  type DiffMode,
} from "./comparison_ui.js";
import { chooseViewport } from "./workspace_actions.js";

/** One version of a comparison. */
export type Side = "after" | "before";

/** A compared frame's kind: a screen's viewport, or a component's frame. */
export type FrameKind = "component" | "desktop" | "mobile";

/** A compared frame's own colour scheme. */
export type FrameScheme = "dark" | "light";

/**
 * Wait until the canvas shows a diff mode's pane frames, and until each of
 * them holds its loaded version. Every compared frame of one comparison
 * shows in the same render, so the frames found first are all of them.
 */
export async function awaitPaneDocuments(page: Page): Promise<void> {
  const frames = comparisonFrames(page);
  await expect(frames).not.toHaveCount(0);
  for (const frame of await frames.all())
    await expect(frame.contentFrame().locator("body")).not.toBeEmpty();
}

/**
 * Open one entry at a wide window, choose its viewport, and show a diff mode
 * until its pane documents load. A component's frames show its desktop
 * views, so a component passes `desktop`.
 */
export async function openComparison(
  page: Page,
  entryPath: string,
  viewport: "both" | "desktop" | "mobile",
  mode: DiffMode,
): Promise<void> {
  // A wide window gives the canvas a larger zoom, so the frames and their
  // regions are larger targets for the pointer and the wheel.
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(`/view/${entryPath}/`);
  await chooseViewport(page, viewport);
  await chooseMode(page, mode);
  await awaitPaneDocuments(page);
}

/**
 * The versions of one compared frame, by the frame's kind and its own
 * scheme. In Overlay, Difference and Swipe it is the frame's figure, whose
 * one shared viewport stacks both versions. In Side by side it is the canvas
 * section that holds the frame's pair, a Before figure and a Current figure,
 * each with its own viewport; Side by side compares one frame, so only the
 * compared frame has a pair.
 */
export function comparisonSection(
  page: Page,
  kind: FrameKind,
  scheme: FrameScheme = "light",
): Locator {
  const frame = `[data-canvas-frame="${kind}"][data-preview-color-scheme="${scheme}"]`;
  const stage = page.locator("[data-mokly-stage]");
  const stack = stage.locator(
    `figure${frame}:has([data-compare-mode]:not([data-compare-mode="side"]))`,
  );
  const pair = stage.locator(
    `[data-canvas-section]:has(figure${frame}[data-canvas-side="before"])`,
  );
  return stack.or(pair);
}

/** The frame that shows one version of a section. */
export function paneFrame(section: Locator, side: Side): Locator {
  return section.locator(`.mb-pane--${side} iframe`);
}

/**
 * The page viewports of a section, the only scroll containers of its pane
 * documents: one in a stack, and one for each version in Side by side.
 */
export function sharedViewports(section: Locator): Locator {
  return section.locator("[data-comparison-viewport]");
}

/**
 * The element of each frame of a section that names the shown mode in its
 * `data-compare-mode`: one in a stack, and one for each version in Side by
 * side.
 */
export function frameModes(section: Locator): Locator {
  return section.locator("[data-compare-mode]");
}

/**
 * The label of each shown frame of a section: a stack's one label, such as
 * `Desktop · Light` and its size tag `1280 × 800`, or in Side by side the
 * Before frame's and then the Current frame's, each led by its tag.
 */
export function frameLabels(section: Locator): Locator {
  return section.locator("figcaption").filter({ visible: true });
}

/**
 * The canvas zoom of a pane frame: its drawn height over its height in the
 * document's CSS pixels. A spec scales a pointer distance by it, because the
 * pointer moves in the page's pixels and the documents scroll in their own.
 */
export function paneZoom(frame: Locator): Promise<number> {
  return frame.evaluate(
    (element: HTMLIFrameElement) =>
      element.getBoundingClientRect().height / element.offsetHeight,
  );
}
