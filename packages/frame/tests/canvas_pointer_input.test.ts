import assert from "node:assert/strict";
import test from "node:test";

import { canvasInputFixture } from "./canvas_input_fixture.js";

test("canvas wheel sums Ctrl and Command deltas at the last point and leaves plain wheel alone", (t) => {
  const { runtime, button, wheel, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-wheel"]);
  const prevented: boolean[] = [];
  button.addEventListener("wheel", (event) =>
    prevented.push(event.defaultPrevented),
  );
  assert.equal(wheel({ deltaY: 7 }), false);
  assert.equal(
    wheel({ ctrlKey: true, deltaY: 12, clientX: 23, clientY: 41 }),
    true,
  );
  assert.equal(
    wheel({ metaKey: true, deltaY: -3, clientX: 29, clientY: 42 }),
    true,
  );
  assert.deepEqual(prevented, [false, true, true]);
  assert.deepEqual(events, []);
  flush();
  assert.deepEqual(events, [
    { type: "canvas-wheel", deltaY: 9, deltaMode: 0, x: 29, y: 42 },
  ]);
});

test("canvas wheel drains delta modes in order through the 60-per-second limit", (t) => {
  const { runtime, wheel, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-wheel"]);
  wheel({ ctrlKey: true, deltaMode: 0, deltaY: 29 });
  wheel({ ctrlKey: true, deltaMode: 1, deltaY: 3 });
  wheel({ ctrlKey: true, deltaMode: 1, deltaY: 4 });
  wheel({ ctrlKey: true, deltaMode: 2, deltaY: -1 });
  assert.deepEqual(events, []);
  for (const [index, deltaY] of [29, 7, -1].entries()) {
    flush(8);
    assert.equal(events.length, index);
    flush(9);
    assert.equal(events.length, index + 1);
    assert.deepEqual(events[index], {
      type: "canvas-wheel",
      deltaY,
      deltaMode: index,
      x: 0,
      y: 0,
    });
  }
});

test("canvas wheel sends nothing when a batch sums to zero", (t) => {
  const { runtime, wheel, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-wheel"]);
  wheel({ ctrlKey: true, deltaY: 5 });
  wheel({ ctrlKey: true, deltaY: -5 });
  flush();
  assert.deepEqual(events, []);
});

test("canvas pinch multiplies relative changes, restarts each baseline and keeps the last point", (t) => {
  const { runtime, gesture, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-pinch"]);
  assert.equal(gesture("gesturestart", 2), true);
  assert.equal(gesture("gesturechange", 4), true);
  assert.equal(gesture("gesturechange", 8, 26, 42), true);
  flush(8);
  assert.deepEqual(events, []);
  flush(9);
  assert.deepEqual(events, [{ type: "canvas-pinch", scale: 4, x: 26, y: 42 }]);

  assert.equal(gesture("gestureend", 16), true);
  assert.equal(gesture("gesturestart", 4), true);
  assert.equal(gesture("gesturechange", 8, 37, 51), true);
  flush(8);
  assert.equal(events.length, 1);
  flush(9);
  assert.deepEqual(events[1], { type: "canvas-pinch", scale: 4, x: 37, y: 51 });
});

test("canvas pinch sends nothing when the net factor is one", (t) => {
  const { runtime, gesture, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-pinch"]);
  gesture("gesturestart", 2);
  gesture("gesturechange", 4);
  gesture("gesturechange", 2);
  gesture("gestureend", 2);
  flush();
  assert.deepEqual(events, []);
});

test("canvas pointer input leaves the document alone outside its subscription", (t) => {
  const { runtime, wheel, gesture, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-key"]);
  assert.equal(wheel({ ctrlKey: true, deltaY: 4 }), false);
  assert.equal(gesture("gesturestart", 1), false);
  assert.equal(gesture("gesturechange", 2), false);
  assert.equal(gesture("gestureend", 2), false);
  flush();
  assert.deepEqual(events, []);
});

test("unsubscribing clears pending canvas input before the next subscription", (t) => {
  const { runtime, wheel, gesture, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-wheel", "canvas-pinch"]);
  wheel({ ctrlKey: true, deltaY: 20 });
  gesture("gesturestart", 1);
  gesture("gesturechange", 2);
  runtime.__subscribe([]);
  assert.equal(wheel({ ctrlKey: true, deltaY: 10 }), false);
  assert.equal(gesture("gesturechange", 4), false);
  runtime.__subscribe(["canvas-wheel", "canvas-pinch"]);
  flush();
  assert.deepEqual(events, []);
});

test("disposing cancels queued canvas input and removes its listeners", (t) => {
  const { runtime, wheel, gesture, key, flush, events, frames } =
    canvasInputFixture(t);
  runtime.__subscribe(["canvas-wheel", "canvas-pinch", "canvas-key"]);
  wheel({ ctrlKey: true, deltaY: 20 });
  gesture("gesturestart", 1);
  gesture("gesturechange", 2);
  runtime.__dispose();
  assert.equal(frames.size, 0);
  assert.equal(wheel({ ctrlKey: true, deltaY: 10 }), false);
  assert.equal(gesture("gestureend", 3), false);
  assert.equal(key({ key: "+" }), false);
  flush();
  assert.deepEqual(events, []);
});
