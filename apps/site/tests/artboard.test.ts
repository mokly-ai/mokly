/**
 * The place of a part on a home canvas: the spread passes each artboard and
 * component set a spot in pixels from the canvas origin, as the home mockup
 * places them, and `spotStyle` turns it into the inline position that the
 * part writes. A part without a spot writes no position.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { spotStyle } from "../src/components/home/artboard.js";

test("a spot places its part in pixels from the canvas origin", () => {
  assert.equal(spotStyle({ x: 30, y: 78 }), "left: 30px; top: 78px");
  assert.equal(spotStyle({ x: -87, y: 52 }), "left: -87px; top: 52px");
});

test("a part without a spot writes no position", () => {
  assert.equal(spotStyle(undefined), undefined);
});
