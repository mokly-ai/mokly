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
  schemaVersion: 2,
  deploymentId: "c".repeat(64),
  canonicalPath: "/view/archive/removed.html",
  comparisonUrl: COMPARISON,
  idRoutes: {},
};

const removedPage: RemovedPreviewData = {
  id: "removed-page",
  kind: "page",
  route: "archive/removed.html",
  title: "Removed page",
};

const removedScreen: RemovedPreviewData = {
  id: "removed-screen",
  kind: "screen",
  route: "screens/removed.html",
  title: "Removed screen",
};

const pagePath = `__mokly/diffs/__generations/${GENERATION}/pages/archive/removed.html.json`;

test("development stages request the stable selected endpoint", () => {
  assert.equal(
    previewEndpoint(removedPage, undefined, BASE, false)?.endpoint.href,
    "https://catalogue.test/__mokly/diffs/review.json?page=archive%2Fremoved.html",
  );
  assert.equal(
    previewEndpoint(removedScreen, undefined, BASE, true)?.endpoint.href,
    "https://catalogue.test/__mokly/diffs/review.json?route=screens%2Fremoved.html&refresh=1",
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
      { ...removedPage, published: { kind: "page", path: pagePath } },
      delivery,
      BASE,
      false,
    )?.endpoint.href,
    `https://catalogue.test/${pagePath}`,
  );
  assert.equal(
    previewEndpoint(
      { ...removedPage, published: { kind: "page", path: pagePath } },
      { comparisonUrl: COMPARISON.slice(1) },
      BASE,
      false,
    )?.endpoint.href,
    `https://catalogue.test/${pagePath}`,
  );
});

test("an advertised address from another generation or route is declined", () => {
  const other = pagePath.replace(GENERATION, "d".repeat(64));
  assert.equal(
    previewEndpoint(
      { ...removedPage, published: { kind: "page", path: other } },
      delivery,
      BASE,
      false,
    ),
    undefined,
  );
  assert.equal(
    previewEndpoint(
      {
        ...removedPage,
        published: {
          kind: "page",
          path: pagePath.replace("removed.html", "other.html"),
        },
      },
      delivery,
      BASE,
      false,
    ),
    undefined,
  );
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
      JSON.stringify({ ...removedPage, route: "../escape.html" }),
    ),
    undefined,
  );
  assert.deepEqual(
    readPreviewDescriptor(
      JSON.stringify({ ...removedPage, published: { kind: "page" } }),
    ),
    removedPage,
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

test("an embedded viewer may request only advertised addresses", () => {
  const model = {
    comparisonUrl: COMPARISON.slice(1),
    removedEntries: [
      { entry: { route: "screens/removed.html" }, preview: { kind: "screen" } },
      {
        entry: { route: "archive/removed.html" },
        preview: { kind: "page", path: pagePath },
      },
      { entry: { route: "flows/tour.html" } },
    ],
  } as unknown as CatalogueReadModel;
  assert.deepEqual(advertisedPreviewPaths(model), [
    COMPARISON.slice(1),
    pagePath,
  ]);
  assert.deepEqual(
    advertisedPreviewPaths({
      comparisonUrl: null,
      removedEntries: [],
    } as unknown as CatalogueReadModel),
    [],
  );
});
