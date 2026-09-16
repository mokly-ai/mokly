import assert from "node:assert/strict";
import test from "node:test";

import {
  APP_PATHS,
  SITEMAP_PATHS,
  SITE_PATHS,
  appLink,
  currentPage,
  isDocsRoute,
} from "../src/navigation.js";

test("every site route is published with a trailing slash", () => {
  assert.deepEqual(Object.values(SITE_PATHS), [
    "/",
    "/docs/",
    "/changelog/",
    "/terms/",
    "/privacy/",
  ]);
  for (const path of Object.values(SITE_PATHS)) {
    assert.ok(path.startsWith("/"), path);
    assert.ok(path.endsWith("/"), path);
  }
});

test("the sitemap publishes every site route and nothing else", () => {
  assert.deepEqual([...SITEMAP_PATHS].sort(), Object.values(SITE_PATHS).sort());
  assert.ok(Object.isFrozen(SITEMAP_PATHS));
});

test("application links resolve against the application origin", () => {
  assert.equal(
    appLink("https://app.example.com", APP_PATHS.signIn),
    "https://app.example.com/sign-in",
  );
  assert.equal(
    appLink("https://app.example.com", APP_PATHS.signUp),
    "https://app.example.com/sign-up",
  );
});

test("a documentation route marks Docs and nothing else", () => {
  for (const route of ["/docs/", "/docs/start/install/", "/docs/cli/build/"]) {
    assert.ok(isDocsRoute(route), route);
    assert.equal(currentPage(route, SITE_PATHS.docs), "page");
    assert.equal(currentPage(route, SITE_PATHS.home), undefined);
    assert.equal(currentPage(route, SITE_PATHS.changelog), undefined);
  }
});

test("other routes mark only themselves", () => {
  assert.equal(currentPage("/", SITE_PATHS.home), "page");
  assert.equal(currentPage("/", SITE_PATHS.docs), undefined);
  assert.equal(currentPage("/terms/", SITE_PATHS.terms), "page");
  assert.equal(currentPage("/terms/", SITE_PATHS.privacy), undefined);
  assert.equal(currentPage("/404", SITE_PATHS.home), undefined);
  assert.equal(isDocsRoute("/documents/"), false);
});
