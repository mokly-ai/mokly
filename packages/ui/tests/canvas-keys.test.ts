import "./dom.js";

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canvasKeyCommand,
  type CanvasKeyEvent,
} from "../src/canvas-stage/canvas-stage.js";

/** A key pressed on the page with no modifier, unless the case sets one. */
function key(fields: Partial<CanvasKeyEvent>): CanvasKeyEvent {
  return {
    altKey: false,
    code: "",
    ctrlKey: false,
    defaultPrevented: false,
    key: "",
    metaKey: false,
    shiftKey: false,
    target: document.body,
    ...fields,
  };
}

test("+ and = zoom in, - zooms out, Shift+0 shows 100% and Shift+1 fits", () => {
  const cases: readonly [Partial<CanvasKeyEvent>, string | undefined][] = [
    [{ key: "+", code: "Equal", shiftKey: true }, "zoom-in"],
    [{ key: "=", code: "Equal" }, "zoom-in"],
    [{ key: "+", code: "NumpadAdd" }, "zoom-in"],
    [{ key: "-", code: "Minus" }, "zoom-out"],
    [{ key: ")", code: "Digit0", shiftKey: true }, "actual-size"],
    [{ key: "!", code: "Digit1", shiftKey: true }, "fit"],
    // A layout whose Shift+0 types "=" still shows 100%.
    [{ key: "=", code: "Digit0", shiftKey: true }, "actual-size"],
    [{ key: "0", code: "Digit0" }, undefined],
    [{ key: "1", code: "Digit1" }, undefined],
    [{ key: "_", code: "Minus", shiftKey: true }, undefined],
    [{ key: "f", code: "KeyF" }, undefined],
  ];
  for (const [fields, command] of cases)
    assert.equal(
      canvasKeyCommand(key(fields)),
      command,
      JSON.stringify(fields),
    );
});

test("the keys act on nothing while ⌘, Ctrl or Alt is held, or once handled", () => {
  for (const modifier of ["metaKey", "ctrlKey", "altKey"] as const) {
    assert.equal(
      canvasKeyCommand(key({ key: "=", code: "Equal", [modifier]: true })),
      undefined,
      modifier,
    );
    assert.equal(
      canvasKeyCommand(
        key({ key: "!", code: "Digit1", shiftKey: true, [modifier]: true }),
      ),
      undefined,
      modifier,
    );
  }
  assert.equal(
    canvasKeyCommand(key({ key: "-", code: "Minus", defaultPrevented: true })),
    undefined,
  );
});

test("the keys stay a text field's own, and act from a button or a switch", () => {
  const field = (markup: string): Element => {
    const holder = document.createElement("div");
    holder.innerHTML = markup;
    document.body.append(holder);
    const element = holder.firstElementChild;
    assert.ok(element);
    return element;
  };
  for (const markup of [
    "<input>",
    '<input type="search">',
    '<input type="number">',
    "<textarea></textarea>",
    "<select><option>One</option></select>",
    '<div contenteditable="true"></div>',
  ])
    assert.equal(
      canvasKeyCommand(key({ key: "-", code: "Minus", target: field(markup) })),
      undefined,
      markup,
    );
  for (const markup of [
    "<button>Fit</button>",
    '<input type="checkbox">',
    '<input type="radio">',
  ])
    assert.equal(
      canvasKeyCommand(key({ key: "-", code: "Minus", target: field(markup) })),
      "zoom-out",
      markup,
    );
});
