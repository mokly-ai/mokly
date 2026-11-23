/**
 * Markers on the canvas, under the viewer markers and canvas stage
 * contracts: a marker follows its frame when the canvas pans, zooms and
 * refits to a smaller stage, and the frame keeps its document throughout. A
 * marker clips to the stage, the canvas between the floating panels and
 * above the zoom pill.
 */

import { expect, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { markerFixture } from "./viewer_marker_fixture.js";
import {
  expectMarkerAligned,
  expectMarkerState,
  openMarkerViewer,
  screenInstance,
  setViewerMarkers,
} from "./viewer_marker_test_helpers.js";
import { canvasFrame } from "./workspace_actions.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof markerFixture>>;
test.beforeAll(async () => {
  fixture = await markerFixture();
});
test.afterAll(async () => fixture?.close());

/** The marker's box on the page. */
async function markerBox(page: Page) {
  const box = await page.locator('[data-mokly-marker="primary"]').boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

/** The stage's box, the canvas between the panels, which is invisible. */
function stageBox(page: Page) {
  return page
    .locator("#one [data-mokly-stage] .mbk-canvas-stage")
    .evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);
}

/** Pan the canvas right by `distance` with a wheel over the stage's corner. */
async function panRight(page: Page, distance: number) {
  const stage = await stageBox(page);
  await page.mouse.move(stage.x + 8, stage.y + 8);
  await page.mouse.wheel(-distance, 0);
}

for (const cross of [false, true])
  test(`${cross ? "postMessage" : "same-origin"} marker follows the canvas's pan, zoom and refit without remounting`, async ({
    page,
  }) => {
    await openMarkerViewer(page, fixture, cross);
    const mobile = canvasFrame("mobile");
    await setViewerMarkers(page, [
      { id: "primary", instance: screenInstance(fixture, "mobile", "action") },
    ]);
    await expectMarkerState(page, "primary", "visible");
    await expect(page.locator("[data-mokly-marker]")).toHaveCount(1);
    await expectMarkerAligned(page, "primary", mobile, "Visible");
    await page.locator(mobile).evaluate((frame: HTMLIFrameElement) => {
      frame.dataset["markerIdentity"] = "retained";
    });

    // A wheel over the canvas around the frames pans it: over the stage,
    // the canvas between the floating panels, which cover its edges. The
    // stage's box is invisible, so its rectangle is read directly.
    const stage = await page
      .locator("#one [data-mokly-stage] .mbk-canvas-stage")
      .evaluate((element) => {
        const { x, y } = element.getBoundingClientRect();
        return { x, y };
      });
    const before = await markerBox(page);
    await page.mouse.move(stage.x + 8, stage.y + 8);
    await page.mouse.wheel(-60, 0);
    await expect
      .poll(async () => Math.round((await markerBox(page)).x - before.x))
      .toBe(60);
    await expectMarkerAligned(page, "primary", mobile, "Visible");

    // Ctrl with the wheel zooms about the pointer, here beside the frame's
    // top left corner, so the marked instance stays on the stage.
    const corner = (await page.locator(mobile).boundingBox())!;
    await page.mouse.move(Math.round(corner.x - 4), Math.round(corner.y - 4));
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -30);
    await page.keyboard.up("Control");
    await expect
      .poll(async () => (await markerBox(page)).width)
      .toBeGreaterThan(before.width * 1.2);
    await expectMarkerAligned(page, "primary", mobile, "Visible");
    const pill = page.getByRole("group", { name: "Zoom" });

    // A fitted canvas refits to a smaller stage, and the marker shrinks. The
    // root shrinks on both axes, so the axis that limits Fit shrinks too.
    await pill.getByRole("button", { name: "Fit" }).click();
    await expectMarkerAligned(page, "primary", mobile, "Visible");
    const fitted = await markerBox(page);
    await page.locator("#one").evaluate((element) => {
      element.style.width = "900px";
      element.style.height = "640px";
    });
    await expect
      .poll(async () => (await markerBox(page)).width)
      .toBeLessThan(fitted.width - 2);
    await expectMarkerAligned(page, "primary", mobile, "Visible");
    await expect(
      page.locator('iframe[data-marker-identity="retained"]'),
    ).toHaveCount(1);
    await expectMarkerState(page, "primary", "visible");
  });

for (const cross of [false, true])
  test(`${cross ? "postMessage" : "same-origin"} marker clips to the stage: cut at its edge beside a floating panel, hidden fully under the panel`, async ({
    page,
  }) => {
    await openMarkerViewer(page, fixture, cross);
    await setViewerMarkers(page, [
      { id: "primary", instance: screenInstance(fixture, "mobile", "action") },
    ]);
    await expectMarkerState(page, "primary", "visible");
    const stage = await stageBox(page);
    const panel = await page
      .locator('#one [data-floating-panel="right"]')
      .boundingBox();
    expect(panel).not.toBeNull();
    // The stage ends before the right panel, which covers the canvas after.
    expect(stage.right).toBeLessThanOrEqual(panel!.x);
    const whole = await markerBox(page);

    // The instance's middle moves to the stage's edge, so the marker keeps
    // its left half, cut at that edge.
    const half = Math.round(stage.right - (whole.x + whole.width / 2));
    await panRight(page, half);
    await expect
      .poll(async () => Math.round((await markerBox(page)).x - whole.x))
      .toBe(half);
    const cut = await markerBox(page);
    expect(Math.abs(cut.x + cut.width - stage.right)).toBeLessThanOrEqual(1);
    expect(cut.width).toBeLessThan(whole.width - 2);
    await expectMarkerState(page, "primary", "visible");

    // The whole instance moves past the stage's edge, under the panel.
    await panRight(page, Math.round(stage.right - cut.x) + 24);
    await expectMarkerState(page, "primary", "hidden");
    await expect(page.locator('[data-mokly-marker="primary"]')).toBeHidden();
  });
