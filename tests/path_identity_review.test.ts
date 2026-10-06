import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { historicalSnapshotId } from "../packages/viewer/src/catalogue/snapshot_identity.js";

import { pageSource, pathFixture } from "./helpers/path_fixture.js";

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

test("transformer path routes have no inherited keys", async (t) => {
  const fixture = await pathFixture(
    {
      "specs/constructor.mockup.ts": pageSource(),
      "transform.ts": `export default ({content,logicalRoutes})=>{if(Object.getPrototypeOf(logicalRoutes)!==null || logicalRoutes.constructor!=="constructor/index.html" || logicalRoutes.__proto__!==undefined || logicalRoutes.toString!==undefined) throw new Error("Unsafe path dictionary"); return content;};`,
    },
    '{mockupsDir:"generated",roots:[{dir:"specs"}],compatibility:{transformer:"transform.ts"}}',
  );
  t.after(fixture.remove);
  await assert.doesNotReject(() => fixture.compile());
});
