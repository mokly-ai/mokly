import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../src/catalogue/reader.js";
import { routeFromUrl } from "../src/shell/routes.js";
import { canonicalRouteUrl } from "../src/shell/store_browser_urls.js";
import { viewerCatalogue } from "../src/viewer/projection.js";

const model = readCatalogue(
  JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../docs/protocol/fixtures/catalogue-v5.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
);
const catalogue = viewerCatalogue(model);

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
