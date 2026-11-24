import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import { act, render } from "@testing-library/react";

import { CanvasStage } from "../src/canvas-stage/canvas-stage.js";

import { SECTION, laidOut, placed, zoomText } from "./canvas-stage-fixture.js";

/** Dispatch one of WebKit's gesture events with its scale and its point. */
function gesture(
  canvas: Element,
  type: "gesturechange" | "gestureend" | "gesturestart",
  scale: number,
  point = { x: 330, y: 16 },
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: point.x, clientY: point.y, scale });
  act(() => {
    canvas.dispatchEvent(event);
  });
  return event;
}

test("Safari's pinch zooms the canvas about the gesture's point, and the page does not zoom", () => {
  const { container } = render(
    <CanvasStage canvasRef={laidOut} section={SECTION} />,
  );
  const canvas = container.firstElementChild!;
  assert.equal(zoomText(), "38%");
  // The scale grows from the start of the gesture: each event zooms by its
  // scale over the one before, about the section's top left, which stays.
  const events = [
    gesture(canvas, "gesturestart", 1),
    gesture(canvas, "gesturechange", 2),
  ];
  assert.equal(zoomText(), "76%");
  assert.equal(placed(container), "translate(330px, 16px)");
  events.push(gesture(canvas, "gesturechange", 3));
  assert.equal(zoomText(), "113%");
  events.push(gesture(canvas, "gestureend", 3));
  assert.equal(zoomText(), "113%");
  // Each gesture event cancels the page's own zoom.
  assert.deepEqual(
    events.map((event) => event.defaultPrevented),
    [true, true, true, true],
  );
  // A new gesture starts from its own scale.
  gesture(canvas, "gesturestart", 1);
  gesture(canvas, "gesturechange", 0.5);
  assert.equal(zoomText(), "57%");
});

test("a touch pinch that the pointers zoom takes no second zoom from Safari's gesture", () => {
  const { container } = render(
    <CanvasStage canvasRef={laidOut} section={SECTION} />,
  );
  const canvas = container.firstElementChild!;
  const touch = (type: string, pointerId: number) =>
    act(() => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: 300 + pointerId * 40,
          clientY: 200,
          pointerId,
          pointerType: "touch",
        }),
      );
    });
  touch("pointerdown", 1);
  touch("pointerdown", 2);
  gesture(canvas, "gesturestart", 1);
  const change = gesture(canvas, "gesturechange", 2);
  assert.equal(change.defaultPrevented, true);
  assert.equal(zoomText(), "38%");
  touch("pointerup", 1);
  touch("pointerup", 2);
});
