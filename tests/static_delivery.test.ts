import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { readCatalogue } from "../packages/viewer/dist/catalogue/reader.js";
import { parseStaticDelivery } from "../packages/viewer/dist/navigation/delivery.js";
import {
  currentDeploymentMatches,
  readShellDelivery,
} from "../packages/viewer/dist/shell/delivery.js";

const descriptor = {
  schemaVersion: 4,
  deploymentId: "a".repeat(64),
  canonicalPath: "/view/screens/home.html",
  comparisonUrl: `/mokly-viewer/diffs/generations/${"a".repeat(64)}/review.json`,
};

test("delivery v4 accepts only same-origin canonical and comparison paths", () => {
  const valid = parseStaticDelivery(descriptor);
  assert.equal(valid.kind, "valid");
  for (const path of [
    "//example.com/home.html",
    "/view/../secret.html",
    "/view/%2e%2e/secret.html",
    "/view/page.html?next=evil",
  ])
    assert.deepEqual(
      parseStaticDelivery({ ...descriptor, canonicalPath: path }),
      { kind: "invalid" },
    );
  assert.deepEqual(
    parseStaticDelivery({
      ...descriptor,
      comparisonUrl: "https://example.com/review.json",
    }),
    { kind: "invalid" },
  );
});

test("delivery canonical paths round trip through the shared entry route grammar", () => {
  for (const canonicalPath of [
    "/",
    "/404.html",
    "/view/components/action.html",
    "/view/pages/guide.html",
    "/view/screens/home.html",
    "/view/user-flows/tour.html",
  ])
    assert.equal(
      parseStaticDelivery({ ...descriptor, canonicalPath }).kind,
      "valid",
    );

  for (const canonicalPath of [
    "/view/screens/nested/home.html",
    "/view/unknown/home.html",
    "/view/screens/con.html",
    "/view/screens/home",
    "/view/screens/Home.html",
  ])
    assert.deepEqual(
      parseStaticDelivery({ ...descriptor, canonicalPath }),
      { kind: "invalid" },
      canonicalPath,
    );
});

test("a static document with missing or malformed metadata never falls back to the server", () => {
  const document = (values: Record<string, string>) =>
    ({
      documentElement: { getAttribute: (key: string) => values[key] ?? null },
    }) as unknown as Document;
  assert.equal(readShellDelivery(document({})), undefined);
  for (const contents of [undefined, "{}", "{"]) {
    const attrs: Record<string, string> = { "data-mokly-static": "" };
    if (contents !== undefined) attrs["data-mokly-delivery"] = contents;
    assert.throws(() => readShellDelivery(document(attrs)), /unavailable/);
  }
  assert.deepEqual(
    readShellDelivery(
      document({
        "data-mokly-static": "",
        "data-mokly-delivery": JSON.stringify(descriptor),
      }),
    ),
    descriptor,
  );
});

test("different deployment identities never validate the current route", async () => {
  const catalogue = readCatalogue(
    JSON.parse(
      fs.readFileSync(
        new URL("../docs/protocol/fixtures/catalogue-v4.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const checked: string[] = [];
  const windowFor = (deploymentId: string) =>
    ({
      fetch: async (input: URL | RequestInfo, init?: RequestInit) => {
        checked.push(String(input));
        assert.equal(init?.cache, "no-store");
        assert.equal(init?.credentials, "omit");
        return Response.json({ ...catalogue, deploymentId });
      },
      location: { href: "https://example.test/view/screens/home.html" },
    }) as unknown as Window & typeof globalThis;
  assert.equal(
    await currentDeploymentMatches(
      windowFor("b".repeat(64)),
      catalogue,
      new AbortController().signal,
    ),
    false,
  );
  assert.equal(
    await currentDeploymentMatches(
      windowFor(catalogue.deploymentId),
      catalogue,
      new AbortController().signal,
    ),
    true,
  );
  assert.deepEqual(checked, [
    "https://example.test/mokly-viewer/catalogue.json",
    "https://example.test/mokly-viewer/catalogue.json",
  ]);
});

test("delivery v2 and malformed deployment descriptors fail closed", () => {
  for (const schemaVersion of [1, 2, 3])
    assert.deepEqual(parseStaticDelivery({ ...descriptor, schemaVersion }), {
      kind: "unsupported-version",
      version: schemaVersion,
    });
  for (const value of [
    { ...descriptor, deploymentId: undefined },
    { ...descriptor, deploymentId: "newest" },
    { ...descriptor, deploymentId: "A".repeat(64) },
  ])
    assert.deepEqual(parseStaticDelivery(value), { kind: "invalid" });
});

test("current-only publication explicitly disables comparisons", () => {
  const delivery = parseStaticDelivery({ ...descriptor, comparisonUrl: null });
  assert.equal(delivery.kind, "valid");
  if (delivery.kind === "valid")
    assert.equal(delivery.value.comparisonUrl, null);
  assert.deepEqual(
    parseStaticDelivery({ ...descriptor, comparisonUrl: undefined }),
    { kind: "invalid" },
  );
});
