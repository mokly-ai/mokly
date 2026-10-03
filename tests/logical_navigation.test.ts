import assert from "node:assert/strict";
import test from "node:test";

import {
  isEntryPath,
  isLogicalFragment,
  parseLogicalMarker,
  parseLogicalTarget,
} from "../packages/viewer/dist/navigation/logical.js";

test("logical navigation validators fail closed for non-string values", () => {
  for (const value of [null, true, 42, ["valid-id"], { value: "valid-id" }]) {
    assert.equal(isEntryPath(value), false);
    assert.equal(isLogicalFragment(value), false);
    assert.equal(parseLogicalTarget(value), undefined);
    assert.equal(parseLogicalMarker(value), undefined);
  }
});

test("logical fragments accept Markdown heading ids and still reject unsafe syntax", () => {
  for (const fragment of ["1section", "café", "日本語", "_name", "a-b-2"])
    assert.deepEqual(parseLogicalTarget(`mock:guide#${fragment}`), {
      path: "guide",
      fragment,
    });
  for (const fragment of [
    "space here",
    "unsafe/part",
    "#heading",
    "café%20",
    '"quoted"',
  ])
    assert.equal(isLogicalFragment(fragment), false);
});
