import assert from "node:assert/strict";
import test from "node:test";

import {
  isCatalogueId,
  isLogicalFragment,
  parseLogicalMarker,
  parseLogicalTarget,
} from "../packages/viewer/dist/navigation/logical.js";

test("logical navigation validators fail closed for non-string values", () => {
  for (const value of [null, true, 42, ["valid-id"], { value: "valid-id" }]) {
    assert.equal(isCatalogueId(value), false);
    assert.equal(isLogicalFragment(value), false);
    assert.equal(parseLogicalTarget(value), undefined);
    assert.equal(parseLogicalMarker(value), undefined);
  }
});
