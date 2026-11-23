import assert from "node:assert/strict";
import { test } from "node:test";

import type { CanvasStageHandle } from "@mokly/ui/canvas-stage";

import {
  routeCanvasInput,
  type CanvasZoomInput,
} from "../src/shell/canvas_removed_input.js";

/** A canvas at a zoom, whose handle records what it is asked to do. */
function canvasAt(zoom: number) {
  const calls: (readonly [string, number | string])[] = [];
  const handle: CanvasStageHandle = {
    fit: () => calls.push(["fit", ""]),
    run: (command) => calls.push(["run", command]),
    zoomIn: () => calls.push(["zoomIn", ""]),
    zoomOut: () => calls.push(["zoomOut", ""]),
    zoomTo: (value) => calls.push(["zoomTo", value]),
  };
  const control = {
    canvas: { current: { clientHeight: 500 } },
    handle: { current: handle },
    zoom: { current: zoom },
  };
  return {
    calls,
    route: (event: CanvasZoomInput) => routeCanvasInput(control, event),
  };
}

test("a canvas key from inside a frame runs the canvas's own command", () => {
  const canvas = canvasAt(0.4);
  for (const key of ["zoom-in", "zoom-out", "zoom-100", "fit"] as const)
    canvas.route({ type: "canvas-key", key });
  assert.deepEqual(canvas.calls, [
    ["run", "zoom-in"],
    ["run", "zoom-out"],
    ["run", "actual-size"],
    ["run", "fit"],
  ]);
});

test("a pinch and a zoom wheel from inside a frame zoom the canvas from its current zoom", () => {
  const canvas = canvasAt(0.4);
  canvas.route({ type: "canvas-pinch", scale: 1.25, x: 10, y: 20 });
  // The wheel zooms by e to the power of minus 0.008 for each pixel; a line
  // is 16 pixels, and a page the canvas's height.
  for (const [deltaY, deltaMode] of [
    [-50, 0],
    [3, 1],
    [1, 2],
  ] as const)
    canvas.route({ type: "canvas-wheel", deltaY, deltaMode, x: 0, y: 0 });
  const [pinch, ...wheels] = canvas.calls.map(([, value]) => Number(value));
  assert.ok(Math.abs(pinch! - 0.5) < 1e-9, `pinch ${pinch}`);
  // 0.4 times e to the power of 0.4, of minus 0.384 and of minus 4.
  const expected = [0.596729879, 0.272452571, 0.007326256];
  wheels.forEach((zoom, index) =>
    assert.ok(
      Math.abs(zoom - expected[index]!) < 1e-8,
      `wheel ${index}: ${zoom} is not ${expected[index]}`,
    ),
  );
  assert.deepEqual(
    canvas.calls.map(([name]) => name),
    ["zoomTo", "zoomTo", "zoomTo", "zoomTo"],
  );
});
