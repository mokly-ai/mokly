import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { historicalSnapshotId } from "../packages/viewer/src/catalogue/snapshot_identity.js";

const sha256 = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("historical snapshot identity pins the v3 path namespace", () => {
  const expected = sha256([
    "mokly-historical-snapshot-v3",
    "a".repeat(64),
    "base",
    "b".repeat(40),
    "page",
    "account/invoice",
  ]);
  assert.equal(
    expected,
    "aa681aaaed2d9e308e67b488424a2a1377d553713efb7c7d50d33bc395751549",
  );
  assert.equal(
    historicalSnapshotId("a".repeat(64), "b".repeat(40), {
      kind: "page",
      path: "account/invoice",
    }),
    expected,
  );
});

test("historical snapshot identity matches the model crate's base vector", () => {
  const catalogue = sha256(["mokly-catalogue-v1", "mokly.config.json"]);
  assert.equal(
    historicalSnapshotId(catalogue, "a".repeat(40), {
      kind: "screen",
      path: "home",
    }),
    "573ad6629703e6bc1859f3192095be04410235f1b11b0ca4e097cd75c3cd675f",
  );
});

test("historical snapshot identity rejects a malformed base commit", () => {
  for (const commit of ["a".repeat(39), "g".repeat(40), "a".repeat(41)])
    assert.throws(() =>
      historicalSnapshotId("a".repeat(64), commit, {
        kind: "screen",
        path: "home",
      }),
    );
});
