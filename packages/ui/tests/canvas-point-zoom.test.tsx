import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { act, render } from "@testing-library/react";
import { createRef } from "react";

import { wheelPixels } from "../src/canvas-stage/canvas-gestures.js";
import {
  CanvasStage,
  type CanvasStageHandle,
} from "../src/canvas-stage/canvas-stage.js";

import { SECTION, laidOut, placed, zoomText } from "./canvas-stage-fixture.js";

test("the handle zooms about a canvas point for a forwarded wheel and pinch", () => {
  const handle = createRef<CanvasStageHandle>();
  const { container } = render(
    <CanvasStage canvasRef={laidOut} ref={handle} section={SECTION} />,
  );
  assert.equal(zoomText(), "38%");
  assert.equal(placed(container), "translate(330px, 16px)");
  // The section's top left keeps its place when the zoom is about it.
  act(() => handle.current?.zoomByAt(2, { x: 330, y: 16 }));
  assert.equal(zoomText(), "76%");
  assert.equal(placed(container), "translate(330px, 16px)");
  // A wheel of -100 pixels multiplies the zoom by e to the power of 0.8.
  act(() => handle.current?.zoomWheelAt(-100, { x: 330, y: 16 }));
  assert.equal(zoomText(), "168%");
  assert.equal(placed(container), "translate(330px, 16px)");
  // The zoom stays within 8% and 400%.
  act(() => handle.current?.zoomByAt(100, { x: 330, y: 16 }));
  assert.equal(zoomText(), "400%");
});

test("a wheel distance counts pixels, lines of 16 pixels, or pages", () => {
  assert.equal(wheelPixels(-40, 0, 600), -40);
  assert.equal(wheelPixels(-3, 1, 600), -48);
  assert.equal(wheelPixels(1, 2, 600), 600);
});
