import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { contentSecurityPolicy } from "../config.js";
import { SITE_FIRST_SEGMENTS } from "../site-segments.js";
import { SITE_FIRST_SEGMENTS as workerSegments } from "../../../worker/src/site-segments.js";
import { DESKTOP_ORIGIN } from "../origin.js";

// Cross-source integration contracts deliberately read their real owners.
const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
test("the shell and Worker use the same generated site segments and domain-owned origin", () => {
  assert.deepEqual(SITE_FIRST_SEGMENTS, workerSegments);
  assert.equal(
    DESKTOP_ORIGIN,
    JSON.parse(source("../../../../fixtures/desktop-origin.json")).origin,
  );
});

test("both harness servers inherit desktop admission from one shared setting", () => {
  const runtime = source("../../../app/src/_tests_/publication-runtime.ts");
  const shared = runtime.slice(
    runtime.indexOf("function publicationEnvironment"),
    runtime.indexOf("function preparePublicationRuntime"),
  );
  assert.match(shared, /MKC_DESKTOP_CLIENT: "true"/);
  assert.equal(runtime.match(/MKC_DESKTOP_CLIENT/g)?.length, 1);
  for (const server of ["api-server", "catalogue-server"]) {
    const harness = source(`../../../app/src/_tests_/${server}.ts`);
    assert.match(harness, /\.\.\.publicationEnvironment\(\)/);
    assert.doesNotMatch(harness, /MKC_DESKTOP_CLIENT/);
  }
});

test("the production policy stays byte-identical to the app server's policy", () => {
  const appServer = source("../../../../infra/docker/app-server.mjs");
  const policy = appServer.slice(
    appServer.indexOf("const catalogueSource"),
    appServer.indexOf("const types"),
  );
  const config = {
    apiOrigin: "https://api.mokly.example",
    appOrigin: "https://mokly.example",
    catalogueBaseDomain: "catalogue.example",
    revision: "a".repeat(40),
  };
  const actual = runInNewContext(policy + "contentSecurityPolicy", { config });
  assert.equal(
    contentSecurityPolicy(config, "https://*.catalogue.example"),
    actual,
  );
});
