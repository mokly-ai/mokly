import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogue } from "../src/catalogue/projection.js";
import type { CatalogueProjectionInput } from "../src/catalogue/projection_input.js";

for (const schemaVersion of [8, 9, 11, "live-index-1"]) {
  test(`catalogue projection rejects ${schemaVersion} before entry access`, () => {
    const input = {
      configPath: "mokly.config.ts",
      changesStatus: "pending",
      comparisonUrl: null,
      catalogue: {
        manifest: {
          schemaVersion,
          get entries() {
            throw new Error("entry identity read before the version gate");
          },
        },
      },
    } as unknown as CatalogueProjectionInput;
    assert.throws(
      () => projectCatalogue(input),
      /current projection requires manifest v10 or live metadata/,
    );
  });
}
