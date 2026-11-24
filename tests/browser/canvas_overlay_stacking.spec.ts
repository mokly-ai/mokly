/**
 * The canvas's overlays under its floating panels, under the canvas stage,
 * component explorer and viewer markers contracts: panning can move a frame
 * under a panel, and the panel then covers the frame's highlight labels as
 * it covers the frame, while they stay drawn. An embedded root's markers
 * clip to the stage, so a marker under the panel hides.
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
import { setFrames, zoomToTags } from "./workspace_actions.js";

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
 * Show the Mobile frames alone and zoom in until the canvas draws them at
 * 60% of their size or more, where the highlight labels show, and then turn
 * Highlight components on.
 */
async function highlightAtLabelZoom(root: Locator): Promise<void> {
  await setFrames(root, { desktop: false, mobile: true });
  await zoomToTags(root);
  await root
    .getByRole("switch", { name: "Highlight components", exact: true })
    .check();
}

/**
 * A point of the stage over the empty canvas, which takes the wheel: a
 * zoomed-in frame can cover the stage's corner, and a frame's document takes
 * a wheel over it.
 */
async function emptyStagePoint(root: Locator): Promise<Point> {
  const stage = await root
    .locator(".mbk-canvas-stage")
    .evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);
  const candidates = [
    [8, 8],
    [8, stage.height / 2],
    [8, stage.height - 8],
    [stage.width - 8, 8],
    [stage.width - 8, stage.height / 2],
  ].map(([x, y]) => ({ x: stage.x + x!, y: stage.y + y! }));
  const point = await root.page().evaluate(
    (points) =>
      points.find(({ x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return (
          hit?.closest(".mbk-canvas") &&
          !hit.closest(".mbk-canvas-frame, .mbk-zoom-pill")
        );
      }),
    candidates,
  );
  expect(point).toBeDefined();
  return point!;
}

/**
 * Pan the canvas with a wheel over the empty stage until the target's left
 * edge stands 24px inside the panel.
 */
async function panUnder(page: Page, root: Locator, target: Locator) {
  const panel = await box(root.locator('[data-floating-panel="right"]'));
  const distance = Math.round(panel.x + 24 - (await box(target)).x);
  expect(distance).toBeGreaterThan(0);
  const start = (await box(target)).x;
  const point = await emptyStagePoint(root);
  await page.mouse.move(point.x, point.y);
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
  const root = page.locator(".mbk[data-mokly-shell]");
  await highlightAtLabelZoom(root);
  const labels = page.locator(".mbk-highlight-label");
  await expect(labels.first()).toBeVisible();
  await panUnder(page, root, await rightmost(labels));
  await expectPanelOver(page, await pointsOverPanel(root, labels));
});

test("in an embedded root, the right panel covers the highlight labels of a frame panned under it, and its marker hides", async ({
  page,
}) => {
  await openMarkerViewer(page, fixture, false);
  const root = page.locator("#one .mbk[data-mokly-shell]");
  await setViewerMarkers(page, [
    { id: "primary", instance: screenInstance(fixture, "mobile", "action") },
  ]);
  await expectMarkerState(page, "primary", "visible");
  await highlightAtLabelZoom(root);
  const labels = root.locator(".mbk-highlight-label");
  await expect(labels.first()).toBeVisible();
  // The Mobile frames' instances start at the same left edge, so the
  // marked instance moves under the panel with the rightmost label.
  await panUnder(page, root, await rightmost(labels));
  // The marker clips to the stage, which ends before the panel.
  await expectMarkerState(page, "primary", "hidden");
  await expect(page.locator('[data-marker-content="primary"]')).toBeHidden();
  await expectPanelOver(page, await pointsOverPanel(root, labels));
});
