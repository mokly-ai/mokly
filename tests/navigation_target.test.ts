import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBrowsingTarget,
  serializeBrowsingTarget,
} from "../packages/viewer/dist/navigation/target.js";

test("browsing targets follow one strict shared grammar", () => {
  const cases = [
    [undefined, { kind: "self" }],
    [null, { kind: "self" }],
    ["", { kind: "self" }],
    ["_self", { kind: "self" }],
    ["_SeLf", { kind: "self" }],
    ["_TOP", { kind: "top" }],
    ["_parent", { kind: "parent" }],
    ["_Blank", { kind: "blank" }],
    ["Report.Frame:2", { kind: "named", name: "Report.Frame:2" }],
    [" report", { kind: "invalid" }],
    ["report ", { kind: "invalid" }],
    ["report\n", { kind: "invalid" }],
    ["_custom", { kind: "invalid" }],
    ["report/path", { kind: "invalid" }],
    ["report+one", { kind: "invalid" }],
  ] as const;

  for (const [input, expected] of cases) {
    assert.deepEqual(parseBrowsingTarget(input), expected, String(input));
  }
  assert.equal(serializeBrowsingTarget({ kind: "self" }), undefined);
  assert.equal(serializeBrowsingTarget({ kind: "top" }), "_top");
  assert.equal(serializeBrowsingTarget({ kind: "parent" }), "_parent");
  assert.equal(serializeBrowsingTarget({ kind: "blank" }), "_blank");
  assert.equal(
    serializeBrowsingTarget({ kind: "named", name: "Report.Frame:2" }),
    "Report.Frame:2",
  );
  assert.equal(serializeBrowsingTarget({ kind: "invalid" }), undefined);
});
