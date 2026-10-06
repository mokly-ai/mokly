import assert from "node:assert/strict";
import test from "node:test";

import {
  SOURCE_ROOTS,
  sourceRoots,
} from "../scripts/verification/ratchets/source-roots.mjs";

test("configured ratchet source roots contain no duplicate directories", () => {
  assert.equal(new Set(SOURCE_ROOTS).size, SOURCE_ROOTS.length);
});

test("root and workspace layouts retain every source directory exactly once", () => {
  assert.deepEqual(sourceRoots("."), [
    "src",
    "scripts",
    "packages/viewer/src",
    "packages/viewer/scripts",
  ]);
  assert.deepEqual(sourceRoots("packages/mokly"), [
    "packages/mokly/src",
    "packages/mokly/scripts",
    "packages/viewer/src",
    "packages/viewer/scripts",
    "scripts",
  ]);
});
