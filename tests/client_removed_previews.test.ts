import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueReadModel } from "../packages/viewer/dist/catalogue/types.js";
import type { StaticDelivery } from "../packages/viewer/dist/navigation/delivery.js";
import { readPreviewDescriptor } from "../packages/viewer/dist/previews/descriptor.js";
import {
  advertisedPreviewPaths,
  previewEndpoint,
} from "../packages/viewer/dist/previews/request.js";
import type { RemovedPreviewData } from "../packages/viewer/dist/shell/previews.js";

const GENERATION = "b".repeat(64);
const COMPARISON = `/__mokly/diffs/__generations/${GENERATION}/review.json`;
const BASE = "https://catalogue.test/view/archive/removed.html";

const delivery: StaticDelivery = {
  schemaVersion: 4,
  deploymentId: "c".repeat(64),
  canonicalPath: "/view/archive/removed.html",
  comparisonUrl: COMPARISON,
};

const removedPage: RemovedPreviewData = {
  id: "removed-page",
  kind: "page",
  title: "Removed page",
};

const removedScreen: RemovedPreviewData = {
  id: "removed-screen",
  kind: "screen",
  title: "Removed screen",
};

const pagePath = `__mokly/diffs/__generations/${GENERATION}/pages/removed-page.json`;

test("development stages request the stable selected endpoint", () => {
  assert.equal(
    previewEndpoint(removedPage, undefined, BASE, false)?.endpoint.href,
    "https://catalogue.test/__mokly/diffs/review.json?page=removed-page",
  );
  assert.equal(
    previewEndpoint(removedScreen, undefined, BASE, true)?.endpoint.href,
    "https://catalogue.test/__mokly/diffs/review.json?id=removed-screen&refresh=1",
  );
});

test("static delivery loads only what the catalogue advertises", () => {
  assert.equal(previewEndpoint(removedPage, delivery, BASE, false), undefined);
  assert.equal(
    previewEndpoint({ ...removedScreen }, delivery, BASE, false),
    undefined,
  );
  assert.equal(
    previewEndpoint(
      { ...removedScreen, published: { kind: "screen" } },
      delivery,
      BASE,
      true,
    )?.endpoint.href,
    `https://catalogue.test${COMPARISON}`,
  );
  assert.equal(
    previewEndpoint(
      { ...removedPage, published: { kind: "page" } },
      delivery,
      BASE,
      false,
    )?.endpoint.href,
    `https://catalogue.test/${pagePath}`,
  );
  assert.equal(
    previewEndpoint(
      { ...removedPage, published: { kind: "page" } },
      { comparisonUrl: COMPARISON.slice(1) },
      BASE,
      false,
    )?.endpoint.href,
    `https://catalogue.test/${pagePath}`,
  );
});

test("a mismatched kind or unavailable generation is declined", () => {
  assert.equal(
    previewEndpoint(
      { ...removedPage, published: { kind: "screen" } },
      delivery,
      BASE,
      false,
    ),
    undefined,
  );
  assert.equal(
    previewEndpoint(
      { ...removedScreen, published: { kind: "screen" } },
      { ...delivery, comparisonUrl: null },
      BASE,
      false,
    ),
    undefined,
  );
});

test("a damaged or unknown descriptor advertises nothing", () => {
  assert.equal(readPreviewDescriptor(null), undefined);
  assert.equal(readPreviewDescriptor("{"), undefined);
  assert.equal(
    readPreviewDescriptor(JSON.stringify({ kind: "component" })),
    undefined,
  );
  assert.equal(
    readPreviewDescriptor(
      JSON.stringify({ kind: "page", title: "Missing id" }),
    ),
    undefined,
  );
  assert.deepEqual(
    readPreviewDescriptor(
      JSON.stringify({ ...removedPage, published: { kind: "page" } }),
    ),
    { ...removedPage, published: { kind: "page" } },
  );
  assert.deepEqual(
    readPreviewDescriptor(
      JSON.stringify({
        ...removedScreen,
        published: { kind: "screen" },
        unknown: 1,
      }),
    ),
    { ...removedScreen, published: { kind: "screen" } },
  );
});

test("the documented embedded fetch set advertises comparison snapshots", () => {
  const model = {
    comparisonUrl: COMPARISON.slice(1),
    removedEntries: [
      { entry: { id: "removed-screen" }, preview: { kind: "screen" } },
      {
        entry: { id: "removed-page" },
        preview: { kind: "page" },
      },
      { entry: { id: "tour" } },
    ],
  } as unknown as CatalogueReadModel;
  assert.deepEqual(advertisedPreviewPaths(model), {
    files: [COMPARISON.slice(1), pagePath],
    prefixes: [
      `__mokly/diffs/__generations/${GENERATION}/snapshots/before/`,
      `__mokly/diffs/__generations/${GENERATION}/snapshots/after/`,
    ],
  });
  assert.deepEqual(
    advertisedPreviewPaths({
      comparisonUrl: null,
      removedEntries: [],
    } as unknown as CatalogueReadModel),
    { files: [], prefixes: [] },
  );
});
