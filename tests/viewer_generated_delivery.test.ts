import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  currentDocumentPath,
  currentDocumentRoute,
} from "../packages/viewer/dist/catalogue/delivery_paths.js";
import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import { MoklyVersionError } from "../packages/viewer/dist/catalogue/version_error.js";

const fixture = JSON.parse(
  fs.readFileSync(
    new URL("../docs/protocol/fixtures/catalogue-v4.json", import.meta.url),
    "utf8",
  ),
);

test("current catalogues require the generated layout and reject earlier versions", () => {
  const catalogue = readCatalogue(fixture);
  assert.equal(catalogue.generatedPathPrefix, "mokly-generated");
  for (const schemaVersion of [1, 2, 3])
    assert.throws(
      () => readCatalogue({ ...fixture, schemaVersion }),
      (error: unknown) =>
        error instanceof MoklyVersionError && error.supported === 4,
    );
  const route = "screens/home.mobile.html";
  assert.equal(currentDocumentPath(route), `static/mokly-generated/${route}`);
  assert.equal(
    currentDocumentPath(route, catalogue.generatedPathPrefix),
    `static/mokly-generated/${route}`,
  );
  assert.equal(currentDocumentRoute(`/static/mokly-generated/${route}`), route);
  assert.equal(
    currentDocumentRoute(`/static/mokly-generated/${route}`, "mokly-generated"),
    route,
  );
  for (const pathname of [
    `/static/${route}`,
    "/static/mokly-generated/../screens/home.mobile.html",
    "/static/mokly-generated/screens%2Fhome.mobile.html",
  ]) {
    assert.equal(currentDocumentRoute(pathname), undefined);
    assert.equal(currentDocumentRoute(pathname, "mokly-generated"), undefined);
  }
});

test("catalogue validation rejects absent and alternate generated prefixes", () => {
  for (const generatedPathPrefix of [undefined, "generated", ".generated"])
    assert.throws(
      () => readCatalogue({ ...fixture, generatedPathPrefix }),
      /generatedPathPrefix/,
    );
});
