import assert from "node:assert/strict";
import test from "node:test";

import { canvasInputFixture } from "./canvas_input_fixture.js";
import { inner } from "./probe_runtime_fixture.js";

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

test("canvas keys leave editable targets and other modifier combinations alone", (t) => {
  const { runtime, doc, key, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-key"]);
  for (const name of ["input", "select", "textarea", "div"]) {
    const target = doc.createElement(name);
    if (name === "div") target.contentEditable = "true";
    doc.body.append(target);
    for (const input of [
      { key: "+" },
      { key: "Escape" },
      { key: "/" },
      { key: "k", code: "KeyK", ctrlKey: true },
    ]) {
      assert.equal(key(input, target), false, `${name} ${input.key}`);
      assert.deepEqual(events, [], `${name} ${input.key}`);
    }
  }
  for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
    for (const input of [{ key: "+" }, { key: "Escape" }, { key: "/" }]) {
      const name = `${modifier} ${input.key}`;
      assert.equal(key({ ...input, [modifier]: true }), false, name);
      assert.deepEqual(events, [], name);
    }
  }
  for (const input of [
    { key: "k", code: "KeyK", ctrlKey: true, shiftKey: true },
    { key: "k", code: "KeyK", ctrlKey: true, metaKey: true },
    { key: "k", code: "KeyK", ctrlKey: true, altKey: true },
    // Dvorak types t on the K key.
    { key: "t", code: "KeyK", ctrlKey: true },
  ]) {
    assert.equal(key(input), false, JSON.stringify(input));
    assert.deepEqual(events, [], JSON.stringify(input));
  }
});

test("Escape and the search keys reach the shell, and only the search keys lose their default action", (t) => {
  const { runtime, key, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-key"]);
  for (const [input, result, prevented] of [
    [{ key: "Escape" }, "escape", false],
    [{ key: "Escape", shiftKey: true }, "escape", false],
    [{ key: "/", code: "Slash" }, "search", true],
    // A German layout types / with Shift+7.
    [{ key: "/", code: "Digit7", shiftKey: true }, "search", true],
    [{ key: "k", code: "KeyK", ctrlKey: true }, "search", true],
    [{ key: "K", code: "KeyK", metaKey: true }, "search", true],
    // A Cyrillic layout types another letter on the K key.
    [{ key: "л", code: "KeyK", ctrlKey: true }, "search", true],
  ] as const) {
    assert.equal(key(input), prevented, JSON.stringify(input));
    assert.deepEqual(
      events.splice(0),
      [{ type: "canvas-key", key: result }],
      JSON.stringify(input),
    );
  }
});

test("Escape stays the document's own when its listener or a pick handles it", (t) => {
  const { runtime, button, key, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-key", "pick-end"]);
  for (const [name, handle] of [
    ["cancels", (event: Event) => event.preventDefault()],
    ["stops", (event: Event) => event.stopPropagation()],
  ] as const) {
    button.addEventListener("keydown", handle);
    key({ key: "Escape" });
    button.removeEventListener("keydown", handle);
    assert.deepEqual(events, [], `the page ${name} Escape`);
  }
  // Escape during a pick ends the pick and stays out of the shell.
  runtime.__highlight([inner], "pick");
  assert.equal(key({ key: "Escape" }), true);
  assert.deepEqual(events.splice(0), [{ type: "pick-end", reason: "escape" }]);
  assert.equal(key({ key: "Escape" }), false);
  assert.deepEqual(events, [{ type: "canvas-key", key: "escape" }]);
});

test("canvas keys need their own subscription", (t) => {
  const { runtime, key, events } = canvasInputFixture(t);
  runtime.__subscribe(["canvas-wheel"]);
  assert.equal(key({ key: "+" }), false);
  // Without it, the search keys keep their default action.
  for (const input of [
    { key: "Escape" },
    { key: "/" },
    { key: "k", code: "KeyK", ctrlKey: true },
  ])
    assert.equal(key(input), false, input.key);
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
