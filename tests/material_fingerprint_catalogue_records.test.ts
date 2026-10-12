import assert from "node:assert/strict";
import test from "node:test";

import { parseFingerprintCatalogueRecords } from "./helpers/fingerprint_catalogue_records.js";

test("catalogue records accept plain and Node 22 comment-prefixed lines", () => {
  const plain = {
    file: "tests/plain.test.ts",
    catalogues: 1,
    pairs: 2,
    fingerprintHashes: 4,
    fingerprintedViews: 2,
    failures: 0,
    excludedCatalogues: 0,
    excludedPairs: 0,
  };
  const commented = { ...plain, file: "tests/commented.test.ts" };
  const output = [
    "TAP version 13",
    `Fingerprint catalogue proof ${JSON.stringify(plain)}`,
    "# unrelated runner diagnostic",
    `# Fingerprint catalogue proof ${JSON.stringify(commented)}`,
    "ok 1 - catalogue checks",
    "",
  ].join("\n");

  assert.deepEqual(parseFingerprintCatalogueRecords(output), [
    plain,
    commented,
  ]);
});
