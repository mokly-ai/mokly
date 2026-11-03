import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogueIndex } from "../packages/viewer/dist/catalogue/index_reader.js";
import { MoklyVersionError } from "../packages/viewer/dist/catalogue/version_error.js";

const fixture = JSON.parse(
  fs.readFileSync(
    new URL("../docs/protocol/fixtures/catalogue-v9.json", import.meta.url),
    "utf8",
  ),
);

test("current catalogues require the generated layout and reject earlier versions", () => {
  const catalogue = readCatalogueIndex(fixture);
  assert.equal(Object.hasOwn(catalogue, "generatedPathPrefix"), false);
  for (const schemaVersion of [1, 2, 3, 4, 5, 6, 7, 8])
    assert.throws(
      () => readCatalogueIndex({ ...fixture, schemaVersion }),
      (error: unknown) =>
        error instanceof MoklyVersionError && error.supported === 9,
    );
});

test("current frame paths require no serialized layout field", () => {
  assert.equal(Object.hasOwn(fixture, "generatedPathPrefix"), false);
  assert.equal(
    Object.hasOwn(readCatalogueIndex(fixture), "generatedPathPrefix"),
    false,
  );
});
