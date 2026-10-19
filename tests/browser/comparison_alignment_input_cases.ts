/**
 * Comparison input checks shared by the copied comparison output and Serve's
 * selected comparisons: wheel, keys, anchors, and scrolls the viewer did not
 * make move every version together on each host.
 */

import { expect, type Locator } from "@playwright/test";

import { comparisonPaths } from "../helpers/comparison_catalogue.js";

import { test as baseTest } from "./browser_test.js";
import {
  comparisonSection,
  documentExtent,
  expectStackAt,
  layerOffsets,
  openComparison,
  paneFrame,
  sharedViewports,
  viewportOffset,
  wheelOver,
} from "./comparison_scroll.js";
import { modeButton } from "./comparison_ui.js";

/** Expect Side by side's two documents and viewports at one offset. */
export async function expectMirrored(
  section: Locator,
  y: number,
): Promise<void> {
  await expect
    .poll(async () => {
      const offsets = await layerOffsets(section);
      return [offsets.before.y, offsets.after.y];
    })
    .toEqual([y, y]);
  const viewports = sharedViewports(section);
  await expect(viewports).toHaveCount(2);
  for (const viewport of await viewports.all())
    await expect.poll(async () => (await viewportOffset(viewport)).y).toBe(y);
}

/** Register the input cases on the host that `test` supplies as its base URL. */
export function registerComparisonAlignmentInput(test = baseTest): void {
  const changed = comparisonPaths.changed;

  test("Side by side mirrors its two viewports in both directions", async ({
    page,
  }) => {
    await openComparison(page, changed, "desktop", "Side by side");
    const desktop = comparisonSection(page, "desktop");
    await expect(desktop.locator(".browser-frame")).toHaveCount(2);
    await wheelOver(page, paneFrame(desktop, "before"), 300);
    await expectMirrored(desktop, 300);
    await wheelOver(page, paneFrame(desktop, "after"), -100);
    await expectMirrored(desktop, 200);
  });

  test("scroll keys pressed inside a pane move the shared viewport", async ({
    page,
  }) => {
    await openComparison(page, changed, "desktop", "Overlay");
    const desktop = comparisonSection(page, "desktop");
    const before = await documentExtent(paneFrame(desktop, "before"));
    const after = await documentExtent(paneFrame(desktop, "after"));
    const step = Math.max(1, Math.floor(after.height * 0.875));
    const end = Math.max(before.range, after.range);
    await paneFrame(desktop, "after").contentFrame().locator("h1").click();
    await page.keyboard.press("Space");
    await expectStackAt(desktop, step);
    await page.keyboard.press("PageDown");
    await expectStackAt(desktop, step * 2);
    await page.keyboard.press("Shift+Space");
    await expectStackAt(desktop, step);
    await page.keyboard.press("PageUp");
    await expectStackAt(desktop, 0);
    await page.keyboard.press("ArrowDown");
    await expectStackAt(desktop, 40);
    await page.keyboard.press("End");
    await expect
      .poll(async () => (await viewportOffset(sharedViewports(desktop))).y)
      .toBe(end);
    await page.keyboard.press("Home");
    await expectStackAt(desktop, 0);

    // An editable field keeps its keys, so the shared viewport stays.
    const field = paneFrame(desktop, "after").contentFrame().locator("#field");
    await field.click();
    await page.keyboard.press("Space");
    await page.keyboard.press("End");
    await expect(field).toHaveValue(" ");
    await expectStackAt(desktop, 0);
  });

  test("a same-document anchor moves every version to its target", async ({
    page,
  }) => {
    await openComparison(page, changed, "desktop", "Overlay");
    const address = page.url();
    const desktop = comparisonSection(page, "desktop");
    const viewport = sharedViewports(desktop);
    // Overlay's top layer is the Current version.
    const after = paneFrame(desktop, "after").contentFrame();
    const target = await after
      .locator("#end")
      .evaluate((node) => node.getBoundingClientRect().top);
    await after.getByRole("link", { name: "Jump to the end" }).click();
    await expect
      .poll(async () => (await viewportOffset(viewport)).y)
      .toBeCloseTo(target, 0);
    await expect
      .poll(() =>
        after
          .locator("#end")
          .evaluate((node) => node.getBoundingClientRect().top),
      )
      .toBeCloseTo(0, 0);
    await expect(page).toHaveURL(address);
    await expect(page.locator("#mb-main h2").first()).toHaveText(
      "Changed screen",
    );

    await modeButton(page, "Side by side").click();
    await expect(desktop.locator(".browser-frame")).toHaveCount(2);
    const before = paneFrame(desktop, "before").contentFrame();
    await before.locator("h1").waitFor();
    await paneFrame(desktop, "before").evaluate((frame: HTMLIFrameElement) =>
      frame.contentDocument!.scrollingElement!.scrollTo({ top: 0 }),
    );
    await expectMirrored(desktop, 0);
    const beforeTarget = await before
      .locator("#end")
      .evaluate((node) => node.getBoundingClientRect().top);
    await before.getByRole("link", { name: "Jump to the end" }).click();
    for (const pane of await sharedViewports(desktop).all())
      await expect
        .poll(async () => (await viewportOffset(pane)).y)
        .toBeCloseTo(beforeTarget, 0);
    await expect(page).toHaveURL(address);
  });

  test("a scroll the viewer did not make pulls every version along", async ({
    page,
  }) => {
    await openComparison(page, changed, "desktop", "Overlay");
    const desktop = comparisonSection(page, "desktop");
    const heading = paneFrame(desktop, "after").contentFrame().locator("#end");
    const top = await heading.evaluate(
      (node) => node.getBoundingClientRect().top,
    );
    await heading.evaluate((node) => node.scrollIntoView());
    await expect
      .poll(async () => (await viewportOffset(sharedViewports(desktop))).y)
      .toBeCloseTo(top, 0);
    const offsets = await layerOffsets(desktop);
    expect(offsets.after.y).toBeCloseTo(top, 0);
    expect(offsets.before.y).toBeCloseTo(
      Math.min(top, (await documentExtent(paneFrame(desktop, "before"))).range),
      0,
    );
  });
}
