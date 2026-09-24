import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  currentDocumentPath,
  currentDocumentRoute,
} from "../packages/viewer/dist/catalogue/delivery_paths.js";
import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";

const fixture = fs.readFileSync(
  new URL("../docs/protocol/fixtures/catalogue-v1.json", import.meta.url),
  "utf8",
);

test("new and previously published catalogues retain their own static layout", () => {
  const oldCatalogue = readCatalogue(JSON.parse(fixture));
  assert.equal(oldCatalogue.generatedPathPrefix, undefined);

  const newCatalogue = readCatalogue(
    JSON.parse(
      fixture
        .replaceAll('"static/', '"static/.generated/')
        .replace(
          '"changesStatus": "ready",',
          '"changesStatus": "ready", "generatedPathPrefix": ".generated",',
        ),
    ),
  );
  assert.equal(newCatalogue.generatedPathPrefix, ".generated");
  const route = "screens/home.mobile.html";
  assert.equal(currentDocumentPath(route), `static/${route}`);
  assert.equal(
    currentDocumentPath(route, newCatalogue.generatedPathPrefix),
    `static/.generated/${route}`,
  );
  assert.equal(currentDocumentRoute(`/static/${route}`), route);
  assert.equal(
    currentDocumentRoute(`/static/.generated/${route}`, ".generated"),
    route,
  );
  assert.equal(
    currentDocumentRoute(`/static/${route}`, ".generated"),
    undefined,
  );
  assert.equal(currentDocumentRoute(`/static/.generated/${route}`), undefined);
  assert.equal(
    currentDocumentRoute(
      "/static/.generated/../screens/home.mobile.html",
      ".generated",
    ),
    undefined,
  );
  assert.equal(
    currentDocumentRoute(
      "/static/.generated/screens%2Fhome.mobile.html",
      ".generated",
    ),
    undefined,
  );
});

test("catalogue validation rejects paths from the other layout", () => {
  const legacy = JSON.parse(fixture);
  assert.throws(
    () => readCatalogue({ ...legacy, generatedPathPrefix: ".generated" }),
    /path must match current fragment|path must match current route/,
  );
  assert.throws(
    () => readCatalogue({ ...legacy, generatedPathPrefix: "generated" }),
    /generatedPathPrefix/,
  );
});
