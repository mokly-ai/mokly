import assert from "node:assert/strict";
import test from "node:test";

import { validMessage } from "../dist/probe/schema.js";

const valid = (fields: object) =>
  validMessage({
    channel: "mokly-frame-probe",
    version: 4,
    nonce: "1".repeat(32),
    ...fields,
  });

test("canvas pointer messages enforce signed coordinate and wheel delta bounds", () => {
  const wheel = {
    type: "canvas-wheel",
    x: -1_000_000,
    y: 1_000_000,
    deltaMode: 0,
    deltaY: -1_000_000,
  };
  const pinch = { type: "canvas-pinch", x: 1_000_000, y: -1_000_000, scale: 2 };
  for (const [body, fields] of [
    [wheel, ["x", "y", "deltaY"]],
    [pinch, ["x", "y"]],
  ] as const) {
    for (const field of fields) {
      for (const value of [-1_000_000, 1_000_000])
        assert.equal(
          valid({ ...body, [field]: value }),
          true,
          `${body.type} ${field} ${value}`,
        );
      for (const value of [
        -1_000_001,
        1_000_001,
        NaN,
        -Infinity,
        Infinity,
        "1",
        null,
      ])
        assert.equal(
          valid({ ...body, [field]: value }),
          false,
          `${body.type} ${field} ${value}`,
        );
    }
  }
});

test("canvas scale and wheel units use their exact ranges", () => {
  const wheel = { type: "canvas-wheel", x: 0, y: 0, deltaY: 10 };
  const pinch = { type: "canvas-pinch", x: 0, y: 0 };
  for (const deltaMode of [0, 1, 2])
    assert.equal(valid({ ...wheel, deltaMode }), true);
  for (const deltaMode of [-1, 0.5, 3, Infinity, "1"])
    assert.equal(valid({ ...wheel, deltaMode }), false, String(deltaMode));
  for (const scale of [Number.MIN_VALUE, 1_000_000])
    assert.equal(valid({ ...pinch, scale }), true);
  for (const scale of [0, -1, 1_000_001, NaN, Infinity, "1"])
    assert.equal(valid({ ...pinch, scale }), false, String(scale));
});

test("canvas key and focus wire values reject names and booleans of the wrong type", () => {
  for (const key of ["zoom-in", "zoom-out", "zoom-100", "fit"])
    assert.equal(valid({ type: "canvas-key", key }), true);
  for (const key of ["+", "other", null, 1])
    assert.equal(valid({ type: "canvas-key", key }), false);
  for (const visible of [true, false])
    assert.equal(valid({ type: "canvas-focus", visible }), true);
  for (const visible of [1, "true", null])
    assert.equal(valid({ type: "canvas-focus", visible }), false);
});
