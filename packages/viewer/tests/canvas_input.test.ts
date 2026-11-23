import assert from "node:assert/strict";
import { test } from "node:test";

import { wheelZoom, type CanvasStageHandle } from "@mokly/ui/canvas-stage";

import {
  framePagePoint,
  hoveredFrame,
  isCanvasInput,
  routeFrameInput,
  type CanvasGestureEvent,
  type CanvasInputTarget,
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

test("without a frame element, a wheel or pinch zooms about its point in the frame under the pointer", () => {
  const pinch = {
    type: "canvas-pinch",
    scale: 2,
    x: 200,
    y: 100,
  } as const;
  const hovered = target(frame());
  const under = hovered.control.canvas.current;
  routeFrameInput(hovered.control, pinch, hoveredFrame(under));
  assert.deepEqual(hovered.calls, [["zoomAt", 2, 200, 100]]);
  // Without a frame under the pointer, it zooms about the stage's centre.
  const elsewhere = target();
  const none = elsewhere.control.canvas.current;
  routeFrameInput(elsewhere.control, pinch, hoveredFrame(none));
  assert.deepEqual(elsewhere.calls, [["zoomTo", 1]]);
});

/**
 * A canvas at a zoom, whose handle records what it is asked to do, for input
 * from a frame that the route does not know.
 */
function canvasAt(zoom: number) {
  const calls: (readonly [string, number | string])[] = [];
  const handle: CanvasStageHandle = {
    fit: () => calls.push(["fit", ""]),
    run: (command) => calls.push(["run", command]),
    zoomAt: (factor) => calls.push(["zoomAt", factor]),
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
    route: (event: CanvasGestureEvent) => routeFrameInput(control, event, null),
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
