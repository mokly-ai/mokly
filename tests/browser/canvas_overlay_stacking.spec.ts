/**
 * The canvas's overlays under its floating panels, under the canvas stage,
 * component explorer and viewer markers contracts: panning can move a frame
 * under a panel, and the panel then covers the frame's highlight labels and
 * an embedded root's markers as it covers the frame, while they stay drawn.
 */

import { expect, type Locator, type Page } from "@playwright/test";

import { test } from "./browser_test.js";
import { markerFixture } from "./viewer_marker_fixture.js";
import {
  expectMarkerState,
  openMarkerViewer,
  screenInstance,
  setViewerMarkers,
} from "./viewer_marker_test_helpers.js";

import type {} from "./viewer_harness.js";

let fixture: Awaited<ReturnType<typeof markerFixture>>;
test.beforeAll(async () => {
  fixture = await markerFixture();
});
test.afterAll(async () => fixture?.close());

/** A point on the page. */
interface Point {
  x: number;
  y: number;
}

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

/** The element of a list that stands furthest right. */
async function rightmost(elements: Locator): Promise<Locator> {
  const lefts = await elements.evaluateAll((list) =>
    list.map((element) => element.getBoundingClientRect().left),
  );
  return elements.nth(lefts.indexOf(Math.max(...lefts)));
}

/**
 * Pan the canvas with a wheel over the stage's corner until the target's
 * left edge stands 24px inside the panel.
 */
async function panUnder(page: Page, root: Locator, target: Locator) {
  const stage = await root
    .locator(".mbk-canvas-stage")
    .evaluate((element) => element.getBoundingClientRect().toJSON() as Point);
  const panel = await box(root.locator('[data-floating-panel="right"]'));
  const distance = Math.round(panel.x + 24 - (await box(target)).x);
  expect(distance).toBeGreaterThan(0);
  const start = (await box(target)).x;
  await page.mouse.move(stage.x + 8, stage.y + 8);
  await page.mouse.wheel(-distance, 0);
  await expect
    .poll(async () => Math.round((await box(target)).x - start))
    .toBe(distance);
}

/**
 * The points 4px inside the left edge of each element, at its middle, that
 * lie over the root's right panel.
 */
async function pointsOverPanel(
  root: Locator,
  elements: Locator,
): Promise<Point[]> {
  const panel = await box(root.locator('[data-floating-panel="right"]'));
  const boxes = await elements.evaluateAll((list) =>
    list.map((element) => element.getBoundingClientRect().toJSON() as DOMRect),
  );
  return boxes
    .map((bounds) => ({ x: bounds.x + 4, y: bounds.y + bounds.height / 2 }))
    .filter(
      ({ x, y }) =>
        x > panel.x &&
        x < panel.x + panel.width &&
        y > panel.y &&
        y < panel.y + panel.height,
    );
}

/** Expect the panel to take the pointer at each point over it. */
async function expectPanelOver(page: Page, points: readonly Point[]) {
  expect(points.length).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      (list) =>
        list.map((point) =>
          Boolean(
            document
              .elementFromPoint(point.x, point.y)
              ?.closest('[data-floating-panel="right"]'),
          ),
        ),
      points,
    ),
  ).toEqual(points.map(() => true));
}

test("in the standalone root, the right panel covers the highlight labels of a frame panned under it", async ({
  page,
}) => {
  await page.goto("/view/example/screens/welcome/");
  await expect(
    page.locator(
      'iframe[data-workspace-frame][data-mokly-frame-state="ready"]',
    ),
  ).toHaveCount(4);
  await page
    .getByRole("button", { name: "Highlight components", exact: true })
    .click();
  const labels = page.locator(".mbk-highlight-label");
  await expect(labels.first()).toBeVisible();
  const root = page.locator(".mbk[data-mokly-shell]");
  await panUnder(page, root, await rightmost(labels));
  await expectPanelOver(page, await pointsOverPanel(root, labels));
});

test("in an embedded root, the right panel covers the markers and highlight labels of a frame panned under it", async ({
  page,
}) => {
  await openMarkerViewer(page, fixture, false);
  const root = page.locator("#one .mbk[data-mokly-shell]");
  await setViewerMarkers(page, [
    { id: "primary", instance: screenInstance(fixture, "mobile", "action") },
  ]);
  await expectMarkerState(page, "primary", "visible");
  const marker = page.locator('[data-marker-content="primary"]');
  await root
    .getByRole("button", { name: "Highlight components", exact: true })
    .click();
  const labels = root.locator(".mbk-highlight-label");
  await expect(labels.first()).toBeVisible();
  await panUnder(page, root, marker);
  // The marker stays drawn on its instance, under the panel.
  await expectMarkerState(page, "primary", "visible");
  await expectPanelOver(page, await pointsOverPanel(root, marker));
  await expectPanelOver(page, await pointsOverPanel(root, labels));
});
