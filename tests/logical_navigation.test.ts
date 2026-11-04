import assert from "node:assert/strict";
import test from "node:test";

import { parseLogicalMarker } from "../packages/frame/dist/navigation/logical.js";

test("logical navigation validators fail closed for non-string values", () => {
  for (const value of [null, true, 42, ["valid-id"], { value: "valid-id" }]) {
    assert.equal(parseLogicalMarker(value), undefined);
  }
});
