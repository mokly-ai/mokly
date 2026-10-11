import assert from "node:assert/strict";
import test from "node:test";

import { authenticateRanges } from "../packages/viewer/dist/client/component_geometry.js";
import { recordedFrameResource } from "../packages/viewer/dist/client/same_origin_access.js";
import { localFrameReady } from "../packages/viewer/dist/client/same_origin_adapter.js";
import {
  createMountAuthentication,
  sameFrameResource,
} from "../packages/viewer/dist/client/same_origin_identity.js";
import { initialFrameLoad } from "../packages/viewer/dist/client/same_origin_load.js";
import type { ComponentViewRecord } from "../packages/viewer/dist/components/manifest_types.js";

const base = "https://app.test";
const route = "home/index.mobile.html";
const usage: ComponentViewRecord = {
  viewport: "mobile",
  colorScheme: "light",
  instances: [],
  slots: [],
  ranges: [],
  styles: [],
  resources: [],
};

for (const [assigned, delivered] of [
  ["%68ome/index.mobile.html", "home/index.mobile"],
  ["home/index.mobile.html", "%68ome/index.mobile"],
  ["home/index.mobile%2ehtml", "home/index.mobile"],
  ["%68ome/index.html", "home/"],
  ["home/index.html", "%68ome"],
]) {
  test(`delivered identity decodes one path layer: ${assigned} to ${delivered}`, () => {
    const expected = new URL(`${base}/static/mokly-generated/${assigned}`);
    const actual = `${base}/static/mokly-generated/${delivered}#position`;
    assert.equal(sameFrameResource(actual, expected), true);
    const { frame, doc } = documentFixture(actual, expected.href);
    assert.equal(recordedFrameResource(frame, actual), true);
    const authentication = createMountAuthentication(frame, doc, expected);
    assert.equal(
      authentication.authenticateAssignedDocument(doc, expected),
      doc,
    );
    assert.equal(
      initialFrameLoad(frame, doc, expected, authentication),
      "adopt",
    );
  });
}

for (const malformed of ["%", "%E0%A4", "home%2Fother", "home%5cother"]) {
  test(`matching malformed delivered paths do not authenticate: ${malformed}`, () => {
    const expected = new URL(
      `${base}/static/mokly-generated/${malformed}/index.html`,
    );
    assert.equal(sameFrameResource(expected.href, expected), false);
  });
}

test("delivered identity keeps remaining percent text literal and matches queries exactly", () => {
  const expected = new URL(
    `${base}/static/mokly-generated/%2568ome/index.mobile.html?rev=%61`,
  );
  assert.equal(sameFrameResource(expected.href, expected), true);
  for (const actual of [
    `${base}/static/mokly-generated/%68ome/index.mobile?rev=%61`,
    `${base}/static/mokly-generated/home/index.mobile?rev=%61`,
    `${base}/static/mokly-generated/%2568ome/index.mobile?rev=a`,
    `https://other.test/static/mokly-generated/%2568ome/index.mobile?rev=%61`,
  ])
    assert.equal(sameFrameResource(actual, expected), false);
});

test("readiness rejects an unexpected query through the delivered-resource rule", () => {
  const { frame } = documentFixture(
    `${base}/static/mokly-generated/${route}?other=1`,
  );
  assert.equal(localFrameReady(frame, route), false);
});

test("geometry rejects an unexpected query through the delivered-resource rule", () => {
  const { frame } = documentFixture(
    `${base}/static/mokly-generated/${route}?other=1`,
  );
  assert.equal(authenticateRanges(frame, route, usage), undefined);
});

test("invalid delivered escapes are unavailable instead of throwing during readiness", () => {
  const { frame } = documentFixture(
    `${base}/static/mokly-generated/%/index.mobile.html`,
  );
  assert.equal(localFrameReady(frame, route), false);
});

function documentFixture(
  actual: string,
  assigned = `${base}/static/mokly-generated/${route}`,
) {
  const location = new URL(actual);
  const frame = {
    ownerDocument: {
      baseURI: `${base}/`,
      defaultView: { location: new URL(base) },
    },
    sandbox: { value: "allow-same-origin" },
    dataset: { fragmentLight: assigned },
    getAttribute: (name: string) => (name === "src" ? assigned : null),
  } as unknown as HTMLIFrameElement;
  const doc = {
    URL: actual,
    readyState: "complete",
    defaultView: { frameElement: frame, location },
    createTreeWalker: () => ({ nextNode: () => null }),
  } as unknown as Document;
  Object.assign(frame, {
    contentDocument: doc,
    contentWindow: doc.defaultView,
  });
  return { frame, doc };
}
