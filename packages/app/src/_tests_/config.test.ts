import assert from "node:assert/strict";
import { test } from "node:test";

import { appOriginFor, siteLinks, siteOriginFor } from "../config";

import { fixtureDesktopOrigin } from "./desktop-fixture";
import { shellPage, tabAt, withWindow } from "./page-window";

/** The public app origin a deployment configures. */
const publicOrigin = "https://mokly.ai";

/** Every outbound site destination, written out as the site serves it. */
function expectedLinks(origin: string) {
  return {
    home: origin + "/",
    docs: origin + "/docs/",
    changelog: origin + "/changelog/",
    pricing: origin + "/pricing",
    terms: origin + "/terms",
    privacy: origin + "/privacy",
    publishFromCi: origin + "/docs/ci/publish-from-ci/",
  };
}

test("a browser tab links the site on its own origin", () => {
  withWindow({ location: tabAt() }, () => {
    assert.deepEqual(
      siteLinks(siteOriginFor(appOriginFor(publicOrigin))),
      expectedLinks("https://app.example.test"),
    );
    assert.equal(appOriginFor(undefined), "https://app.example.test");
    assert.equal(appOriginFor(" https://mokly.ai/ "), publicOrigin);
  });
});

test("the desktop shell links the site on the configured public app origin", () => {
  withWindow({ location: shellPage() }, () => {
    const site = siteLinks(siteOriginFor(appOriginFor(publicOrigin)));
    assert.deepEqual(site, expectedLinks(publicOrigin));
    for (const link of Object.values(site)) {
      assert.ok(!link.startsWith(fixtureDesktopOrigin), link);
    }
    // A build with no configured origin falls back to the local default,
    // never to the page's own desktop origin.
    assert.equal(appOriginFor(undefined), "http://localhost:8081");
  });
});

test("outside a browser the site follows the configured public app origin", () => {
  withWindow(undefined, () => {
    assert.deepEqual(
      siteLinks(siteOriginFor(publicOrigin)),
      expectedLinks(publicOrigin),
    );
    assert.equal(appOriginFor(undefined), "http://localhost:8081");
  });
  withWindow({}, () => {
    assert.equal(siteOriginFor(publicOrigin), publicOrigin);
  });
});
