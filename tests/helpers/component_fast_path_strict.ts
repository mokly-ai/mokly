import assert from "node:assert/strict";

import {
  assertFastPathEquivalent,
  type FastPathFixture,
} from "./component_fast_path.js";

/** Branch shortcut proofs require at least one view to settle on the fast path. */
export function assertStrictFastPathEquivalent(fixture: FastPathFixture) {
  return assertFastPathEquivalent(fixture, (counts) => {
    assert.ok(Number(counts?.fastPath) > 0, "fast path settled no views");
  });
}
