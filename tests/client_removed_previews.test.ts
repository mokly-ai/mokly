import assert from "node:assert/strict";
import test from "node:test";

import {
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
