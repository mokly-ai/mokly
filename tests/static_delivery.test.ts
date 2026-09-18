import assert from "node:assert/strict";
import test from "node:test";

import {
  adoptStaticDelivery,
  readStaticDelivery,
} from "../packages/viewer/dist/client/static_delivery.js";
import {
  parseStaticDelivery,
  resolveDeliveryHref,
  validFragmentQuery,
} from "../packages/viewer/dist/navigation/delivery.js";

const descriptor = {
  schemaVersion: 2,
  deploymentId: "a".repeat(64),
  canonicalPath: "/view/screens/home.html",
  idRoutes: { home: "/view/screens/home.html" },
  comparisonUrl: `/__mokly/diffs/__generations/${"a".repeat(64)}/review.json`,
};

test("static metadata never authorizes external URLs, traversal, or unknown ids", () => {
  const valid = parseStaticDelivery(descriptor);
  assert.ok(valid);
  assert.equal(
    resolveDeliveryHref("/id/home?fragment=heading", valid),
    "/view/screens/home.html?fragment=heading",
  );
  assert.equal(resolveDeliveryHref("/id/missing", valid), undefined);
  assert.equal(resolveDeliveryHref("/id/homeindex.html", valid), undefined);
  for (const path of [
    "//example.com/home.html",
    "/view/../secret.html",
    "/view/%2e%2e/secret.html",
    "/view/page.html?next=evil",
  ])
    assert.equal(
      parseStaticDelivery({ ...descriptor, idRoutes: { home: path } }),
      undefined,
    );
  assert.equal(
    parseStaticDelivery({
      ...descriptor,
      comparisonUrl: "https://example.com/review.json",
    }),
    undefined,
  );
  assert.equal(validFragmentQuery("?fragment=a&fragment=b"), "");
  assert.equal(validFragmentQuery("?fragment=%23bad"), "");
});

test("a static document with missing or malformed metadata never falls back to the server", () => {
  const document = (values: Record<string, string>) =>
    ({
      documentElement: { getAttribute: (key: string) => values[key] ?? null },
    }) as unknown as Document;
  assert.equal(readStaticDelivery(document({})), undefined);
  for (const contents of [undefined, "{}", "{"]) {
    const attrs: Record<string, string> = { "data-mokly-static": "" };
    if (contents !== undefined) attrs["data-mokly-delivery"] = contents;
    assert.throws(() => readStaticDelivery(document(attrs)), /unavailable/);
  }
  assert.deepEqual(
    readStaticDelivery(
      document({
        "data-mokly-static": "",
        "data-mokly-delivery": JSON.stringify(descriptor),
      }),
    ),
    parseStaticDelivery(descriptor),
  );
});

test("different deployment identities never adopt a route with the same comparison URL", () => {
  const document = (deploymentId: string) => {
    const values = new Map([
      ["data-mokly-static", ""],
      ["data-mokly-delivery", JSON.stringify({ ...descriptor, deploymentId })],
    ]);
    return {
      documentElement: {
        getAttribute: (key: string) => values.get(key) ?? null,
        setAttribute: (key: string, value: string) => values.set(key, value),
      },
    } as unknown as Document;
  };
  const current = document("a".repeat(64));
  const before = current.documentElement.getAttribute("data-mokly-delivery");
  assert.equal(adoptStaticDelivery(current, document("b".repeat(64))), false);
  assert.equal(
    current.documentElement.getAttribute("data-mokly-delivery"),
    before,
  );
  assert.equal(adoptStaticDelivery(current, document("a".repeat(64))), true);
});

test("old and malformed deployment descriptors fail closed", () => {
  for (const value of [
    { ...descriptor, schemaVersion: 1 },
    { ...descriptor, deploymentId: undefined },
    { ...descriptor, deploymentId: "newest" },
    { ...descriptor, deploymentId: "A".repeat(64) },
  ])
    assert.equal(parseStaticDelivery(value), undefined);
});

test("current-only publication explicitly disables comparisons without losing id routes", () => {
  const delivery = parseStaticDelivery({ ...descriptor, comparisonUrl: null });
  assert.ok(delivery);
  assert.equal(delivery.comparisonUrl, null);
  assert.equal(
    resolveDeliveryHref("/id/home?fragment=heading", delivery),
    "/view/screens/home.html?fragment=heading",
  );
  assert.equal(
    parseStaticDelivery({ ...descriptor, comparisonUrl: undefined }),
    undefined,
  );
});
