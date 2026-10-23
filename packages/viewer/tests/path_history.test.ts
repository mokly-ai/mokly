import assert from "node:assert/strict";
import test from "node:test";

import { routeFromUrl } from "../src/shell/routes.js";
import { canonicalRouteUrl } from "../src/shell/store_browser_urls.js";

import { catalogueFixture, indexFixture } from "./catalogue_v7_fixture.js";

const model = indexFixture();
const catalogue = catalogueFixture(model);

test("every accepted shell path canonicalizes history without losing query or hash", () => {
  const path = model.screens[0]!.path;
  for (const suffix of ["", "/", "/index.html"]) {
    const url = new URL(
      `https://catalogue.test/view/${path}${suffix}?viewport=mobile&source=link#content`,
    );
    assert.equal(
      canonicalRouteUrl(url, routeFromUrl(catalogue, url)).href,
      `https://catalogue.test/view/${path}/?viewport=mobile&source=link#content`,
    );
  }
});

test("missing paths canonicalize without resolving to another entry", () => {
  const url = new URL("https://catalogue.test/view/unknown/index.html");
  const route = routeFromUrl(catalogue, url);
  assert.equal(route.view.kind, "missing");
  assert.equal(canonicalRouteUrl(url, route).pathname, "/view/unknown/");
});
