import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LINE_STEP,
  scrollKeyTarget,
  type ScrollKey,
} from "../src/shell/comparison_scroll_keys.js";

const AREA = { height: 800, range: { x: 300, y: 2000 } };
const PAGE = 700;

function press(
  key: string,
  fields: Partial<Omit<ScrollKey, "key">> = {},
): ScrollKey {
  return {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key,
    metaKey: false,
    shiftKey: false,
    target: null,
    ...fields,
  };
}

test("scroll keys move the shared viewport by the browser's steps", () => {
  const from = { x: 100, y: 1000 };
  const cases: [ScrollKey, { x: number; y: number }][] = [
    [press(" "), { x: 100, y: 1000 + PAGE }],
    [press(" ", { shiftKey: true }), { x: 100, y: 1000 - PAGE }],
    [press("PageDown"), { x: 100, y: 1000 + PAGE }],
    [press("PageUp"), { x: 100, y: 1000 - PAGE }],
    [press("Home"), { x: 100, y: 0 }],
    [press("End"), { x: 100, y: 2000 }],
    [press("ArrowDown"), { x: 100, y: 1000 + LINE_STEP }],
    [press("ArrowUp"), { x: 100, y: 1000 - LINE_STEP }],
    [press("ArrowRight"), { x: 100 + LINE_STEP, y: 1000 }],
    [press("ArrowLeft"), { x: 100 - LINE_STEP, y: 1000 }],
  ];
  for (const [event, expected] of cases)
    assert.deepEqual(scrollKeyTarget(event, from, AREA), expected, event.key);
});

test("targets stay inside the shared range", () => {
  assert.deepEqual(
    scrollKeyTarget(press("PageDown"), { x: 0, y: 1900 }, AREA),
    {
      x: 0,
      y: 2000,
    },
  );
  assert.deepEqual(scrollKeyTarget(press("ArrowLeft"), { x: 10, y: 0 }, AREA), {
    x: 0,
    y: 0,
  });
});

test("handled, composing, command and unrelated keys are left alone", () => {
  const from = { x: 0, y: 0 };
  for (const event of [
    press(" ", { defaultPrevented: true }),
    press(" ", { isComposing: true }),
    press("End", { ctrlKey: true }),
    press("End", { metaKey: true }),
    press("ArrowDown", { altKey: true }),
    press("Enter"),
    press("a"),
  ])
    assert.equal(scrollKeyTarget(event, from, AREA), undefined, event.key);
});

test("editable controls keep their keys and Space activates buttons", () => {
  const from = { x: 0, y: 0 };
  for (const target of [
    { localName: "input" },
    { localName: "textarea" },
    { localName: "select" },
    { isContentEditable: true, localName: "div" },
  ])
    assert.equal(
      scrollKeyTarget(
        press("PageDown", { target: target as never }),
        from,
        AREA,
      ),
      undefined,
    );
  for (const localName of ["button", "summary"]) {
    const target = { localName } as never;
    assert.equal(
      scrollKeyTarget(press(" ", { target }), from, AREA),
      undefined,
    );
    assert.deepEqual(
      scrollKeyTarget(press("PageDown", { target }), from, AREA),
      {
        x: 0,
        y: PAGE,
      },
    );
  }
  assert.deepEqual(
    scrollKeyTarget(
      press(" ", { target: { localName: "a" } as never }),
      from,
      AREA,
    ),
    { x: 0, y: PAGE },
  );
});
