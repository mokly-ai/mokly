import assert from "node:assert/strict";
import { test } from "node:test";

import type { CanvasStageHandle } from "@mokly/ui/canvas-stage";

import {
  framePagePoint,
  isCanvasInput,
  routeCanvasInput,
} from "../src/shell/canvas_input.js";

/** A box on the page, as `getBoundingClientRect` gives it. */
function box(left: number, top: number, width: number, height: number) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  };
}

/**
 * A frame of 1280 × 800 that the canvas draws at half size, 100px from the
 * page's left and 50px from its top, with a border of `border` pixels.
 */
function frame(border = 0): HTMLIFrameElement {
  const outer = { width: 1280 + 2 * border, height: 800 + 2 * border };
  return {
    clientLeft: border,
    clientTop: border,
    getBoundingClientRect: () =>
      box(100, 50, outer.width / 2, outer.height / 2),
    offsetHeight: outer.height,
    offsetWidth: outer.width,
  } as unknown as HTMLIFrameElement;
}

/** A canvas 40px from the page's left and 20px from its top, 600px tall. */
const canvas = {
  clientHeight: 600,
  getBoundingClientRect: () => box(40, 20, 900, 600),
} as unknown as HTMLElement;

/** A handle that records the calls that the route makes. */
function recordingHandle() {
  const calls: unknown[][] = [];
  const handle: CanvasStageHandle = {
    fit: () => calls.push(["fit"]),
    run: (command) => calls.push(["run", command]),
    zoomByAt: (factor, point) => calls.push(["zoomByAt", factor, point]),
    zoomIn: () => calls.push(["zoomIn"]),
    zoomOut: () => calls.push(["zoomOut"]),
    zoomTo: (zoom) => calls.push(["zoomTo", zoom]),
    zoomWheelAt: (deltaY, point) => calls.push(["zoomWheelAt", deltaY, point]),
  };
  return { calls, handle };
}

test("a point of a frame's viewport maps to the page through the frame's box and scale", () => {
  assert.deepEqual(framePagePoint(frame(), { x: 0, y: 0 }), { x: 100, y: 50 });
  assert.deepEqual(framePagePoint(frame(), { x: 200, y: 100 }), {
    x: 200,
    y: 100,
  });
  // The viewport starts inside the frame's border, which scales too.
  assert.deepEqual(framePagePoint(frame(4), { x: 200, y: 100 }), {
    x: 202,
    y: 102,
  });
});

test("a forwarded wheel zooms about its point on the canvas, in pixels", () => {
  const { calls, handle } = recordingHandle();
  // (200, 100) in the frame stands at (200, 100) on the page, which is
  // (160, 80) on the canvas.
  const at = { x: 160, y: 80 };
  for (const [deltaY, deltaMode] of [
    [-40, 0],
    [-3, 1],
    [1, 2],
  ] as const)
    routeCanvasInput(
      { type: "canvas-wheel", deltaY, deltaMode, x: 200, y: 100 },
      frame(),
      canvas,
      handle,
    );
  // Lines count 16 pixels and pages the canvas's height, as its own wheel.
  assert.deepEqual(calls, [
    ["zoomWheelAt", -40, at],
    ["zoomWheelAt", -48, at],
    ["zoomWheelAt", 600, at],
  ]);
});

test("a forwarded pinch multiplies the zoom about its point, and a key runs its command", () => {
  const { calls, handle } = recordingHandle();
  routeCanvasInput(
    { type: "canvas-pinch", scale: 1.25, x: 0, y: 0 },
    frame(),
    canvas,
    handle,
  );
  for (const key of ["zoom-in", "zoom-out", "zoom-100", "fit"] as const)
    routeCanvasInput({ type: "canvas-key", key }, frame(), canvas, handle);
  assert.deepEqual(calls, [
    ["zoomByAt", 1.25, { x: 60, y: 30 }],
    ["run", "zoom-in"],
    ["run", "zoom-out"],
    ["run", "actual-size"],
    ["run", "fit"],
  ]);
});

test("only the canvas events of a frame count as canvas input", () => {
  for (const event of [
    { type: "canvas-wheel", deltaY: 1, deltaMode: 0, x: 0, y: 0 },
    { type: "canvas-pinch", scale: 2, x: 0, y: 0 },
    { type: "canvas-key", key: "fit" },
    { type: "canvas-focus", visible: true },
    { type: "canvas-blur" },
  ] as const)
    assert.equal(isCanvasInput(event), true, event.type);
  for (const event of [
    { type: "geometry" },
    { type: "hover", key: null, boxes: [] },
    { type: "error", code: "limit" },
  ] as const)
    assert.equal(isCanvasInput(event), false, event.type);
});
