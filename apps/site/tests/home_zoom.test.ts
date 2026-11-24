/**
 * The zoom of the home's zoom pill, as the Home zoom section of
 * docs/protocol/cloud/site-chrome.md fixes it: the 8% to 200% range, the
 * steps of 1.25 and 0.8, the stop at each end, the landing on 100% within
 * half a step of it, and the zoom as a whole percentage. Each expected zoom
 * is worked by hand from those rules. `home_zoom_island.test.ts` runs the
 * island that presses the steps.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  type ZoomStep,
  atRangeEnd,
  stepZoom,
  zoomPercent,
} from "../src/components/home/zoom.js";

/** The percentages that `presses` presses of `step` show from `start`. */
function shown(start: number, step: ZoomStep, presses: number): string[] {
  const seen: string[] = [];
  let zoom = start;
  for (let press = 0; press < presses; press += 1) {
    zoom = stepZoom(zoom, step);
    seen.push(zoomPercent(zoom));
  }
  return seen;
}

test("Zoom out multiplies the zoom by 0.8 down to 8%, where it stops", () => {
  assert.deepEqual(shown(1, "out", 13), [
    "80%",
    "64%",
    "51%",
    "41%",
    "33%",
    "26%",
    "21%",
    "17%",
    "13%",
    "11%",
    "9%",
    "8%",
    "8%",
  ]);
  assert.equal(stepZoom(0.0859, "out"), 0.08, "a step past 8% stops at 8%");
});

test("Zoom in multiplies the zoom by 1.25 up to 200%, where it stops", () => {
  assert.deepEqual(shown(1, "in", 5), ["125%", "156%", "195%", "200%", "200%"]);
  assert.equal(stepZoom(1.953125, "in"), 2, "a step past 200% stops at 200%");
});

test("a step that lands within half a step of 100% lands on 100%", () => {
  // From 200%: 160%, 128%, then 102.4%, which lands on 100%.
  assert.deepEqual(shown(2, "out", 3), ["160%", "128%", "100%"]);
  assert.equal(stepZoom(1.28, "out"), 1);
  // From 8%: up to 74.5%, then 93.1%, which lands on 100%.
  assert.deepEqual(shown(0.08, "in", 11), [
    "10%",
    "13%",
    "16%",
    "20%",
    "24%",
    "31%",
    "38%",
    "48%",
    "60%",
    "75%",
    "100%",
  ]);
  assert.equal(stepZoom(0.7450580596923828, "in"), 1);
  // A full step from 100% leaves it in both directions.
  assert.equal(stepZoom(1, "in"), 1.25);
  assert.equal(stepZoom(1, "out"), 0.8);
});

test("the pill shows the zoom as a whole percentage", () => {
  assert.equal(zoomPercent(1), "100%");
  assert.equal(zoomPercent(0.4096), "41%");
  assert.equal(zoomPercent(1.5625), "156%");
  assert.equal(zoomPercent(0.08), "8%");
});

test("only the step at its end of the range stands at an end", () => {
  assert.deepEqual(
    [0.08, 0.0859, 1, 1.953125, 2].map((zoom) => [
      atRangeEnd(zoom, "out"),
      atRangeEnd(zoom, "in"),
    ]),
    [
      [true, false],
      [false, false],
      [false, false],
      [false, false],
      [false, true],
    ],
  );
});
