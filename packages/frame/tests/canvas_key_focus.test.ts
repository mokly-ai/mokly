import assert from "node:assert/strict";
import test from "node:test";

import { canvasInputFixture } from "./canvas_input_fixture.js";

test("canvas keys map immediately, repeat and keep the document's default handling", (t) => {
  const { runtime, key, events, frames } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-key"]);
  for (const [input, result] of [
    [{ key: "+" }, "zoom-in"],
    [{ key: "=", repeat: true }, "zoom-in"],
    [{ key: "-" }, "zoom-out"],
    [{ key: "=", code: "Digit0", shiftKey: true }, "zoom-100"],
    [{ key: "!", code: "Digit1", shiftKey: true }, "fit"],
  ] as const) {
    assert.equal(key(input), false);
    assert.deepEqual(events.pop(), { type: "canvas-key", key: result });
  }
  assert.equal(key({ key: "0", code: "Digit0" }), false);
  assert.deepEqual(events, []);
  assert.equal(frames.size, 0);
});

test("canvas keys leave editable targets and command modifiers alone", (t) => {
  const { runtime, doc, key, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-key"]);
  for (const name of ["input", "select", "textarea", "div"]) {
    const target = doc.createElement(name);
    if (name === "div") target.contentEditable = "true";
    doc.body.append(target);
    assert.equal(key({ key: "+" }, target), false, name);
    assert.deepEqual(events, [], name);
  }
  for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
    assert.equal(key({ key: "+", [modifier]: true }), false, modifier);
    assert.deepEqual(events, [], modifier);
  }
});

test("canvas keys need their own subscription", (t) => {
  const { runtime, key, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-wheel"]);
  assert.equal(key({ key: "+" }), false);
  assert.deepEqual(events, []);
});

test("subscribing to canvas focus publishes the current state on the next tick", (t) => {
  const { runtime, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-focus", "canvas-blur"]);
  assert.deepEqual(events, []);
  flush();
  assert.deepEqual(events, [{ type: "canvas-blur" }]);
});

test("a focus-only subscription reports equal visits without reporting blur", (t) => {
  const { runtime, focus, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-focus"]);
  flush();
  const initial = events.splice(0);

  focus("focus", true, true);
  flush();
  focus("blur", false);
  flush();
  focus("focus", true, true);
  flush();

  assert.deepEqual(
    { initial, events },
    {
      initial: [],
      events: [
        { type: "canvas-focus", visible: true },
        { type: "canvas-focus", visible: true },
      ],
    },
  );
});

test("canvas focus reports the browser's focus visibility and blur without prevention", (t) => {
  const { runtime, focus, button, flush, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-focus", "canvas-blur"]);
  flush();
  events.length = 0;
  assert.equal(focus("focus", true, true, button), false);
  flush();
  assert.deepEqual(events.pop(), { type: "canvas-focus", visible: true });
  assert.equal(focus("focus", true, false, button), false);
  flush();
  assert.deepEqual(events.pop(), { type: "canvas-focus", visible: false });
  assert.equal(focus("blur", false), false);
  flush();
  assert.deepEqual(events, [{ type: "canvas-blur" }]);
});

test("canvas focus coalesces blur and focus and suppresses an unchanged pair", (t) => {
  const { runtime, focus, button, flush, events } = canvasInputFixture(t);
  focus("focus", true, true);
  runtime.__subscribe(["canvas-focus", "canvas-blur"]);
  flush();
  assert.deepEqual(events.pop(), { type: "canvas-focus", visible: true });
  focus("blur", false);
  focus("focus", true, false, button);
  flush(8);
  assert.deepEqual(events, []);
  flush(9);
  assert.deepEqual(events.pop(), { type: "canvas-focus", visible: false });
  focus("focus", true, false, button);
  flush();
  assert.deepEqual(events, []);
});

test("canvas focus reads no state without a subscription or after disposal", (t) => {
  const { runtime, focus, focusReads, flush, events } = canvasInputFixture(t);
  focus("focus", true);
  flush();
  assert.equal(focusReads(), 0);
  runtime.__subscribe(["canvas-focus", "canvas-blur"]);
  focus("blur", false);
  runtime.__subscribe([]);
  flush();
  assert.equal(focusReads(), 0);
  runtime.__subscribe(["canvas-focus", "canvas-blur"]);
  runtime.__dispose();
  focus("focus", true);
  flush();
  assert.equal(focusReads(), 0);
  assert.deepEqual(events, []);
});
