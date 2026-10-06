import assert from "node:assert/strict";
import test from "node:test";

import { covered, uncovered } from "./coverage-subject.mjs";

test("coverage reporter fixture", () => {
  assert.equal(covered(1), "positive");
  assert.equal(typeof uncovered, "function");
});
