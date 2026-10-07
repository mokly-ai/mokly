import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { historicalSnapshotId } from "../packages/viewer/src/catalogue/snapshot_identity.js";

test("historical snapshot identity pins the v3 path namespace", () => {
  const expected = createHash("sha256")
    .update(
      JSON.stringify([
        "mokly-historical-snapshot-v3",
        "a".repeat(64),
        "baseline",
        "b".repeat(40),
        "page",
        "account/invoice",
      ]),
    )
    .digest("hex");
  assert.equal(
    expected,
    "d3d8e9606fd93df437bce04332eecc027560ed1c3a8c6ba80990682d2940ed03",
  );
  assert.equal(
    historicalSnapshotId(
      "a".repeat(64),
      { kind: "baseline", identity: "b".repeat(40) },
      { kind: "page", path: "account/invoice" },
    ),
    expected,
  );
});
