import assert from "node:assert/strict";
import test from "node:test";

import { CONTROLS_COPY as DESIGN } from "../examples/basic/specs/design/components/controls/parts/copy.js";
import { CONTROLS_COPY as VIEWER } from "../packages/viewer/dist/shell/component_controls_copy.js";

type Copy = (...input: unknown[]) => string;

/** Titles, names, and number fields with both, one, or no bounds and steps. */
const INPUTS: readonly unknown[][] = [
  ["Default"],
  ["Welcome"],
  [0, 24],
  [0],
  [undefined, 24],
  [],
  [0, 24, 1],
  [2, 8, 2],
  [undefined, 24, 0.5],
  [undefined, undefined, 0.1],
];

test("the viewer's Props controls use the settled copy of the controls mockups", () => {
  assert.deepEqual(Object.keys(VIEWER).sort(), Object.keys(DESIGN).sort());
  for (const [key, value] of Object.entries(DESIGN)) {
    const shown = VIEWER[key as keyof typeof VIEWER];
    if (typeof value !== "function") {
      assert.equal(shown, value, key);
      continue;
    }
    assert.equal(typeof shown, "function", key);
    for (const input of INPUTS)
      assert.equal(
        (shown as Copy)(...input),
        (value as Copy)(...input),
        `${key}(${input.join(", ")})`,
      );
  }
});

test("number fields name their bounds and step in the settled forms", () => {
  assert.equal(DESIGN.range(0, 24, 1), "0–24");
  assert.equal(DESIGN.range(0), "0 or more");
  assert.equal(DESIGN.range(undefined, 24), "24 or less");
  assert.equal(DESIGN.range(), "");
  assert.equal(DESIGN.range(2, 8, 2), "2–8 in steps of 2");
  assert.equal(DESIGN.range(undefined, undefined, 0.1), "In steps of 0.1");
  assert.equal(DESIGN.numberError(0, 24, 1), "Enter a number from 0 to 24.");
  assert.equal(DESIGN.numberError(0), "Enter a number of 0 or more.");
  assert.equal(
    DESIGN.numberError(undefined, 24),
    "Enter a number of 24 or less.",
  );
  assert.equal(DESIGN.numberError(), "Enter a number.");
  assert.equal(
    DESIGN.numberError(2, 8, 2),
    "Enter a number from 2 to 8 in steps of 2.",
  );
  assert.equal(
    DESIGN.numberError(undefined, undefined, 0.1),
    "Enter a number in steps of 0.1.",
  );
});
