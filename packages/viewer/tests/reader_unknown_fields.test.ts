import assert from "node:assert/strict";
import { test } from "node:test";

import { readDeploymentFile } from "../src/catalogue/deployment_reader.js";
import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import { readLiveDescriptor } from "../src/catalogue/live_reader.js";
import type { ComponentRenderRequest } from "../src/components/render_types.js";
import { parseRemovedPagePreview } from "../src/review/page_preview.js";
import { readRenderResponse } from "../src/standalone/live_render.js";

import {
  extendEverywhere,
  richDetails,
  richIndex,
} from "./reader_unknown_fixtures.js";

/** A reader owns a complete copy, including fields it does not use. */
function copies(read: (value: unknown) => unknown, value: object): void {
  const input = { ...value, later: { nested: true } };
  const expected = structuredClone(input);
  let actual: unknown;
  assert.doesNotThrow(() => {
    actual = read(input);
  });
  assert.deepEqual(actual, expected);
  assert.notStrictEqual(actual, input);
  input.later.nested = false;
  assert.deepEqual(actual, expected);
}

test("the index reader copies additive fields and trusts same-version content", () => {
  const index = richIndex();
  extendEverywhere(index);
  index.identity.title = "Another title";
  copies(readCatalogueIndex, index);
});

test("the detail reader copies additive fields and trusts same-version content", () => {
  const detail = richDetails().find(
    (candidate) => candidate.entry.path === "product/browse/home",
  )!;
  extendEverywhere(detail);
  Object.assign(detail.views[0]!, {
    usage: { status: "pending", ranges: [] },
  });
  copies(readEntryDetail, detail);
});

test("the live descriptor copies additive fields and trusts same-version content", () => {
  copies(readLiveDescriptor, {
    schemaVersion: 3,
    generation: "short",
    render: { url: "/another-render-route", token: "", later: true },
  });
});

test("the deployment reader copies additive fields and trusts same-version content", () => {
  copies(readDeploymentFile, { schemaVersion: 1, deploymentId: "short" });
});

test("the removed page preview copies additive fields and trusts same-version content", () => {
  copies(parseRemovedPagePreview, {
    schemaVersion: 3,
    baseRef: "main",
    baseCommit: "short",
    path: "guide",
  });
});

test("the render reader copies additive fields and trusts response content", () => {
  const request: ComponentRenderRequest = {
    entryPath: "product/browse/home",
    viewport: "mobile",
    colorScheme: "light",
    revision: 3,
    pageId: "0123456789abcdef0123456789abcdef",
    overrides: {},
  };
  copies((value) => readRenderResponse(value, request), {
    renderId: "r-1",
    revision: 3,
    previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
    props: { label: ["future-prop-value", "Go"] },
    usage: { status: "pending", ranges: [], later: true },
  });
});
