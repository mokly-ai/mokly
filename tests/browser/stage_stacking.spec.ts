/**
 * The compact layout below the layout breakpoint stands its one frame at the
 * stage's top, below the entry bar, so the frame stays reachable, and keeps
 * it there when a taller window leaves room below it.
 */

import { expect, type Page } from "@playwright/test";

import { FIT_MARGIN } from "../../packages/ui/src/canvas-stage/canvas-view.js";

import { test } from "./browser_test.js";

/** The section's and the shown frame label's offsets on the stage. */
function geometry(page: Page) {
  return page.locator("[data-mokly-stage]").evaluate((canvas) => {
    const box = (selector: string) =>
      canvas.querySelector(selector)!.getBoundingClientRect();
    const stage = box(".mbk-canvas-stage");
    const section = box(".mbk-canvas-section");
    const label = box(".mbk-canvas-cell:not([hidden]) figcaption");
    return {
      label: label.top - stage.top,
      section: section.top - stage.top,
      spare: stage.bottom - section.bottom,
    };
  });
}

test("below the layout breakpoint, the compact frame starts at the stage's top so it stays reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/view/example/screens/welcome/");
  const label = page.locator(
    "[data-mokly-stage] .mbk-canvas-cell:not([hidden]) figcaption",
  );
  await expect(label).toContainText("welcome · Mobile · Light");
  expect((await geometry(page)).label).toBeGreaterThanOrEqual(0);

  // A window with room below the frame distinguishes the top alignment from
  // centring: the section keeps Fit's margin from the stage's top.
  await page.setViewportSize({ width: 390, height: 1800 });
  await expect
    .poll(async () => (await geometry(page)).spare)
    .toBeGreaterThan(100);
  await expect
    .poll(async () => (await geometry(page)).section)
    .toBeCloseTo(FIT_MARGIN, 0);
});
