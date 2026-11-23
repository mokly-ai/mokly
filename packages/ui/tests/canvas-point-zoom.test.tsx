import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { act, render } from "@testing-library/react";
import { createRef } from "react";

import { wheelPixels } from "../src/canvas-stage/canvas-gestures.js";
import {
  CanvasStage,
  wheelZoom,
  type CanvasStageHandle,
} from "../src/canvas-stage/canvas-stage.js";

import { SECTION, laidOut, placed, zoomText } from "./canvas-stage-fixture.js";

test("the handle zooms by a factor about a point of the page", () => {
  const handle = createRef<CanvasStageHandle>();
  const { container } = render(
    <CanvasStage canvasRef={laidOut} ref={handle} section={SECTION} />,
  );
  // happy-dom places the canvas at the page's top left, so a page point is
  // the same canvas point.
  assert.equal(zoomText(), "38%");
  assert.equal(placed(container), "translate(330px, 16px)");
  // The section's top left keeps its place when the zoom is about it.
  act(() => handle.current?.zoomAt(2, 330, 16));
  assert.equal(zoomText(), "76%");
  assert.equal(placed(container), "translate(330px, 16px)");
  // A wheel of -100 pixels multiplies the zoom by e to the power of 0.8.
  act(() => handle.current?.zoomAt(wheelZoom(1, -100), 330, 16));
  assert.equal(zoomText(), "168%");
  assert.equal(placed(container), "translate(330px, 16px)");
  // Another point moves the section away from it; the zoom stays within
  // 8% and 400%.
  act(() => handle.current?.zoomAt(100, 0, 0));
  assert.equal(zoomText(), "400%");
  assert.notEqual(placed(container), "translate(330px, 16px)");
});

test("a wheel distance counts pixels, lines of 16 pixels, or pages", () => {
  assert.equal(wheelPixels(-40, 0, 600), -40);
  assert.equal(wheelPixels(-3, 1, 600), -48);
  assert.equal(wheelPixels(1, 2, 600), 600);
});
