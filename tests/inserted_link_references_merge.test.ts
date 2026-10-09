import assert from "node:assert/strict";
import test from "node:test";

import {
  compareMergedPage,
  mergedPage,
} from "./helpers/merged_page_fixture.js";

test("inserted-link recipes preserve canonical inline resource seeds", async () => {
  const page = mergedPage(
    "sheet.css",
    false,
    '<style>.action{background:url("../asset.svg")}</style>',
  );
  for (const useMaterialFingerprints of [false, true]) {
    const result = await compareMergedPage(
      page,
      page,
      {
        before: { "sheet.css": "", "asset.svg": "before" },
        after: { "sheet.css": "", "asset.svg": "after" },
      },
      ["mockups/asset.svg"],
      { useFastPath: false, useStylePath: false, useMaterialFingerprints },
    );
    assert.deepEqual(result.reasons, []);
    assert.deepEqual(result.ownedResources, [
      {
        componentId: "action",
        reason: { kind: "dependency", path: "mockups/asset.svg" },
      },
    ]);
    assert.deepEqual(result.view.reasons, [
      { kind: "dependency", path: "mockups/asset.svg" },
    ]);
    assert.equal(result.view.state, "changed");
  }
});
