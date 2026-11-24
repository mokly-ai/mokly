import assert from "node:assert/strict";
import { test } from "node:test";

import {
  readingSize,
  sectionExtent,
} from "../src/canvas-section/canvas-section.js";
import {
  fitView,
  stepZoom,
  wheelZoom,
  zoomAbout,
  type CanvasView,
} from "../src/canvas-stage/canvas-view.js";

/** A screen's four frames: Desktop beside Mobile, Light above Dark. */
const SCREEN = sectionExtent(
  "screen",
  [
    { column: 0, row: 0, width: 1280, height: 800 },
    { column: 1, row: 0, width: 390, height: 844 },
    { column: 0, row: 1, width: 1280, height: 800 },
    { column: 1, row: 1, width: 390, height: 844 },
  ],
  { width: 0, height: 0 },
);

/** The stage between floating panels at 1440 × 900: 860 × 804 at x 260. */
const STAGE = { left: 260, top: 0, width: 860, height: 804 };

function near(actual: number, expected: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) < 1e-6,
    `${label}: ${actual} is not ${expected}`,
  );
}

test("Fit takes the largest zoom at which the frames, the padding and the gaps fit, and centres the section", () => {
  const view = fitView(SCREEN, STAGE);
  // Rows: 64 + 844z + 48 + 844z + 22 fit 804 less two 16px margins.
  near(view.zoom, 638 / 1688, "zoom");
  // The section is 88 + 1670z wide and 134 + 1688z tall.
  near(view.x, 260 + (860 - (88 + (1670 * 638) / 1688)) / 2, "x");
  near(view.y, 16, "y");
  assert.equal(view.fitted, true);
});

test("Fit stops at 100%, and a reading frame fills the stage's height up to a 760px width", () => {
  const stage = { left: 0, top: 0, width: 1200, height: 800 };
  const reading = readingSize(stage);
  assert.deepEqual(reading, { width: 760, height: 682 });
  const view = fitView(
    sectionExtent("document", [{ column: 0, row: 0 }], reading),
    stage,
  );
  assert.deepEqual(view, { fitted: true, x: 198, y: 16, zoom: 1 });
  const small = fitView(
    sectionExtent(
      "component",
      [{ column: 0, row: 0, width: 200, height: 100 }],
      reading,
    ),
    stage,
  );
  assert.equal(small.zoom, 1);
});

test("the compact layout fits one frame with only its label's room, at the stage's top", () => {
  // A phone's stage: 390 wide, 668 tall below the entry bar and above the dock.
  const stage = { left: 0, top: 52, width: 390, height: 668 };
  const mobile = sectionExtent(
    "screen",
    [{ column: 0, row: 0, width: 390, height: 844 }],
    { width: 0, height: 0 },
    true,
  );
  const view = fitView(mobile, stage, "start");
  // Rows: 22 + 844z fit 668 less two 16px margins.
  near(view.zoom, 614 / 844, "zoom");
  near(view.x, (390 - (390 * 614) / 844) / 2, "x");
  near(view.y, 52 + 16, "y");
  // A frame that needs less room keeps 100% and still stands at the top.
  const small = fitView(
    sectionExtent(
      "component",
      [{ column: 0, row: 0, width: 148, height: 86 }],
      { width: 0, height: 0 },
      true,
    ),
    stage,
    "start",
  );
  assert.deepEqual(small, { fitted: true, x: 121, y: 68, zoom: 1 });
  // A compact reading frame takes the stage's width less Fit's margins.
  assert.deepEqual(readingSize(stage, true), { width: 358, height: 614 });
});

test("Fit keeps 8% on a stage too small for the section and shows its top left", () => {
  const view = fitView(SCREEN, { left: 10, top: 20, width: 200, height: 200 });
  assert.deepEqual(view, { fitted: true, x: 26, y: 36, zoom: 0.08 });
});

test("a hidden frame takes no room in the section, so Fit leaves it out", () => {
  assert.deepEqual(
    sectionExtent(
      "screen",
      [
        { column: 0, row: 0, width: 1280, height: 800, hidden: true },
        { column: 0, row: 0, width: 390, height: 844 },
      ],
      { width: 0, height: 0 },
    ),
    {
      columns: [{ fixed: 22 }, { scaled: 390 }, { fixed: 22 }],
      rows: [{ fixed: 64 }, { scaled: 844 }, { fixed: 22 }],
    },
  );
});

test("a use case's section keeps its step frames in one row, with room above it for the steps' descriptions", () => {
  assert.deepEqual(
    sectionExtent(
      "use-case",
      [
        { column: 0, row: 0, width: 1280, height: 800 },
        { column: 1, row: 0, width: 1280, height: 800 },
      ],
      { width: 0, height: 0 },
    ),
    {
      columns: [
        { fixed: 22 },
        { scaled: 1280 },
        { fixed: 44 },
        { scaled: 1280 },
        { fixed: 22 },
      ],
      rows: [{ fixed: 92 }, { scaled: 800 }, { fixed: 22 }],
    },
  );
});

test("Zoom in and Zoom out step by 1.25 and 0.8 between 8% and 400%", () => {
  const view: CanvasView = { fitted: true, x: 0, y: 0, zoom: 0.5 };
  const larger = stepZoom(view, SCREEN, STAGE, "in");
  near(larger.zoom, 0.625, "in");
  assert.equal(larger.fitted, false);
  near(stepZoom(view, SCREEN, STAGE, "out").zoom, 0.4, "out");
  const top = { ...view, zoom: 3.5 };
  assert.equal(stepZoom(top, SCREEN, STAGE, "in").zoom, 4);
  const bottom = { ...view, zoom: 0.09 };
  assert.equal(stepZoom(bottom, SCREEN, STAGE, "out").zoom, 0.08);
});

test("a zoom about a point keeps the section's point under it, in a frame and in the head", () => {
  const view: CanvasView = { fitted: false, x: 100, y: 50, zoom: 0.5 };
  // 100px into the Mobile frame: 22 + 640 + 44 + 100 from the left edge,
  // and 30px down, in the head's padding.
  const point = { x: 906, y: 80 };
  const next = zoomAbout(view, SCREEN, 1, point);
  assert.deepEqual(next, { fitted: false, x: -640, y: 50, zoom: 1 });
  // Back at 100%: 22 + 1280 + 44 + 200 puts the same point under 906.
  assert.equal(next.x + 22 + 1280 + 44 + 200, 906);
});

test("the wheel zooms by e to the power of minus 0.008 for each pixel", () => {
  near(wheelZoom(1, -100), Math.exp(0.8), "in");
  near(wheelZoom(0.5, 125), 0.5 * Math.exp(-1), "out");
});
