import assert from "node:assert/strict";
import { test } from "node:test";

import { wheelZoom, type CanvasStageHandle } from "@mokly/ui/canvas-stage";

import {
  framePagePoint,
  isCanvasInput,
  routeFrameInput,
  type CanvasInputTarget,
} from "../src/shell/canvas_input.js";
import { routeCanvasInput } from "../src/shell/canvas_removed_input.js";

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

/**
 * A canvas 600px tall at a zoom of 0.5, whose handle records each call. The
 * canvas reports `hovered` as the frame under the pointer.
 */
function target(hovered: HTMLIFrameElement | null = null) {
  const calls: unknown[][] = [];
  const handle: CanvasStageHandle = {
    fit: () => calls.push(["fit"]),
    run: (command) => calls.push(["run", command]),
    zoomAt: (factor, x, y) => calls.push(["zoomAt", factor, x, y]),
    zoomIn: () => calls.push(["zoomIn"]),
    zoomOut: () => calls.push(["zoomOut"]),
    zoomTo: (zoom) => calls.push(["zoomTo", zoom]),
  };
  const canvas = {
    clientHeight: 600,
    querySelector: (selector: string) =>
      selector === "iframe:hover" ? hovered : null,
  } as unknown as HTMLElement;
  const control: CanvasInputTarget = {
    canvas: { current: canvas },
    handle: { current: handle },
    zoom: { current: 0.5 },
  };
  return { calls, control };
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

test("a forwarded wheel zooms about its point in the frame at the canvas's wheel rate", () => {
  const { calls, control } = target();
  for (const [deltaY, deltaMode] of [
    [-40, 0],
    [-3, 1],
    [1, 2],
  ] as const)
    routeFrameInput(
      control,
      { type: "canvas-wheel", deltaY, deltaMode, x: 200, y: 100 },
      frame(),
    );
  // Lines count 16 pixels and pages the canvas's height, as its own wheel;
  // (200, 100) in the frame stands at (200, 100) on the page.
  assert.deepEqual(calls, [
    ["zoomAt", wheelZoom(1, -40), 200, 100],
    ["zoomAt", wheelZoom(1, -48), 200, 100],
    ["zoomAt", wheelZoom(1, 600), 200, 100],
  ]);
});

test("a forwarded pinch zooms by its scale about its point, and a key runs its command", () => {
  const { calls, control } = target();
  routeFrameInput(
    control,
    { type: "canvas-pinch", scale: 1.25, x: 0, y: 0 },
    frame(),
  );
  for (const key of ["zoom-in", "zoom-out", "zoom-100", "fit"] as const)
    routeFrameInput(control, { type: "canvas-key", key }, frame());
  assert.deepEqual(calls, [
    ["zoomAt", 1.25, 100, 50],
    ["run", "zoom-in"],
    ["run", "zoom-out"],
    ["run", "actual-size"],
    ["run", "fit"],
  ]);
});

test("a previous version's wheel or pinch zooms about its point in the frame under the pointer", () => {
  const hovered = target(frame());
  routeCanvasInput(hovered.control, {
    type: "canvas-pinch",
    scale: 2,
    x: 200,
    y: 100,
  });
  assert.deepEqual(hovered.calls, [["zoomAt", 2, 200, 100]]);
  // Without a frame under the pointer, it zooms about the stage's centre.
  const elsewhere = target();
  routeCanvasInput(elsewhere.control, {
    type: "canvas-pinch",
    scale: 2,
    x: 200,
    y: 100,
  });
  assert.deepEqual(elsewhere.calls, [["zoomTo", 1]]);
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
