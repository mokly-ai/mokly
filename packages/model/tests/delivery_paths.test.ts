import assert from "node:assert/strict";
import test from "node:test";

import { currentDocumentPath, currentDocumentRoute } from "../src/index.js";

test("current generated documents map to their static routes", () => {
  const route = "home/index.mobile.html";
  assert.equal(currentDocumentPath(route), `static/mokly-generated/${route}`);
  assert.equal(currentDocumentPath(route), `static/mokly-generated/${route}`);
  assert.equal(currentDocumentRoute(`/static/mokly-generated/${route}`), route);
  assert.equal(currentDocumentRoute(`/static/mokly-generated/${route}`), route);
  for (const pathname of [
    `/static/${route}`,
    "/static/mokly-generated/../home/index.mobile.html",
    "/static/mokly-generated/screens%2Fhome.mobile.html",
  ]) {
    assert.equal(currentDocumentRoute(pathname), undefined);
    assert.equal(currentDocumentRoute(pathname), undefined);
  }
});

test("hosted document admission follows current paths and rejects encoded separators", () => {
  for (const pathname of [
    "/view/constructor/home.html",
    "/static/../secret.html",
    "/external/home.html",
    "/static/mokly-generated/a%2fb/index.html",
    "/static/mokly-generated/%2e%2e/secret/index.html",
    "/static/mokly-generated/con/home/index.html",
  ])
    assert.equal(currentDocumentRoute(pathname), undefined);
  assert.equal(
    currentDocumentRoute("/static/mokly-generated/constructor/home/index.html"),
    "constructor/home/index.html",
  );
  assert.equal(
    currentDocumentRoute("/static/mokly-generated/team/index.desktop.html"),
    "team/index.desktop.html",
  );
});
