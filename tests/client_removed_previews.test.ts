import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueReadModel } from "../packages/viewer/dist/catalogue/types.js";
import { readPreviewDescriptor } from "../packages/viewer/dist/previews/descriptor.js";
import {
  advertisedPreviewPaths,
  previewEndpoint,
  type PreviewDelivery,
} from "../packages/viewer/dist/previews/request.js";
import type { RemovedPreviewData } from "../packages/viewer/dist/shell/previews.js";

const GENERATION = "b".repeat(64);
const COMPARISON = `/mokly-viewer/diffs/generations/${GENERATION}/`;
const BASE = "https://catalogue.test/view/archive/removed/";

const delivery: PreviewDelivery = { comparisonUrl: COMPARISON };

const removedPage: RemovedPreviewData = {
  path: "removed-page",
  kind: "page",
  title: "Removed page",
};

const removedScreen: RemovedPreviewData = {
  path: "removed-screen",
  kind: "screen",
  title: "Removed screen",
};

const pagePath = `mokly-viewer/diffs/generations/${GENERATION}/previews/removed-page/index.json`;

/** A removed screen's preview reads its removed detail inside the generation. */
const screenPath = `mokly-viewer/diffs/generations/${GENERATION}/entries/removed-screen.json`;

test("development stages never discover an unadvertised preview endpoint", () => {
  assert.equal(
    previewEndpoint(
      { ...removedPage, published: { kind: "page" } },
      undefined,
      BASE,
    ),
    undefined,
  );
  assert.equal(
    previewEndpoint(
      { ...removedScreen, published: { kind: "screen" } },
      undefined,
      BASE,
    ),
    undefined,
  );
});

test("every delivery loads only what the catalogue advertises", () => {
  assert.equal(previewEndpoint(removedPage, delivery, BASE), undefined);
  assert.equal(
    previewEndpoint({ ...removedScreen }, delivery, BASE),
    undefined,
  );
  assert.equal(
    previewEndpoint(
      { ...removedScreen, published: { kind: "screen" } },
      delivery,
      BASE,
    )?.endpoint.href,
    `https://catalogue.test/${screenPath}`,
  );
  assert.equal(
    previewEndpoint(
      { ...removedPage, published: { kind: "page" } },
      delivery,
      BASE,
    )?.endpoint.href,
    `https://catalogue.test/${pagePath}`,
  );
  assert.equal(
    previewEndpoint(
      { ...removedPage, published: { kind: "page" } },
      { comparisonUrl: COMPARISON.slice(1) },
      BASE,
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
    ),
    undefined,
  );
  assert.equal(
    previewEndpoint(
      { ...removedScreen, published: { kind: "screen" } },
      { ...delivery, comparisonUrl: null },
      BASE,
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
      { entry: { path: "removed-screen" }, preview: { kind: "screen" } },
      {
        entry: { path: "removed-page" },
        preview: { kind: "page" },
      },
      { entry: { path: "tour" } },
    ],
  } as unknown as CatalogueReadModel;
  assert.deepEqual(advertisedPreviewPaths(model), {
    files: [screenPath, pagePath],
    prefixes: [
      `mokly-viewer/diffs/generations/${GENERATION}/snapshots/before/`,
      `mokly-viewer/diffs/generations/${GENERATION}/snapshots/after/`,
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
