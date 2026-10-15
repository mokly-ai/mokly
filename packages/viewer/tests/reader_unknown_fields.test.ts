import assert from "node:assert/strict";
import { test } from "node:test";

import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import { readLiveDescriptor } from "../src/catalogue/live_reader.js";
import type { ComponentRenderRequest } from "../src/components/render_types.js";
import { readRenderResponse } from "../src/standalone/live_render.js";

import { rawDetailFixtures, rawIndexFixture } from "./catalogue_v7_fixture.js";
import {
  extendEverywhere,
  richDetails,
  richIndex,
  richUsage,
} from "./reader_unknown_fixtures.js";

type Raw = Record<string, unknown>;

/** A copy of `value` with one unknown field added to every record in it. */
function extended<T>(value: T): T {
  const copy = structuredClone(value);
  extendEverywhere(copy);
  return copy;
}

test("the walk reaches every record kind the readers read", () => {
  const index = extended(richIndex()) as unknown as Raw;
  const action = (index.components as Raw[])[0]!;
  const controls = action.controls as Record<string, Raw>;
  assert.equal(controls.later, undefined);
  for (const control of Object.values(controls)) assert.equal(control.later, 1);
  assert.equal((controls.tone!.options as Raw[])[0]!.later, 1);
  assert.equal((action.propSchema as Raw).later, undefined);
  const nested = ((index.tree as Raw[])[1]!.children as Raw[])[1]!;
  assert.equal(((nested.children as Raw[])[1]!.children as Raw[])[0]!.later, 1);
  const home = richDetails().find(
    (detail) => detail.entry.path === "product/browse/home",
  )!;
  const usage = (extended(home).views[0] as unknown as Raw).usage as Raw;
  const instance = (usage.instances as Raw[])[0]!;
  assert.equal(instance.later, 1);
  assert.equal((instance.owner as Raw).later, 1);
  assert.equal((instance.source as Raw).later, 1);
  assert.equal((instance.props as Raw).later, undefined);
  assert.equal(((usage.slots as Raw[])[0]!.owner as Raw).later, 1);
  assert.equal(((usage.ranges as Raw[])[1]!.target as Raw).later, 1);
});

test("the index reader ignores additive fields at every depth", () => {
  const index = richIndex();
  assert.deepEqual(
    readCatalogueIndex(extended(index)),
    readCatalogueIndex(index),
  );
});

test("the detail reader ignores additive fields at every depth", () => {
  const details = richDetails();
  assert.ok(details.some((detail) => detail.views.length));
  for (const detail of details)
    assert.deepEqual(
      readEntryDetail(extended(detail)),
      readEntryDetail(detail),
      detail.entry.path,
    );
});

test("the render answer reader ignores additive fields at every depth", () => {
  const request: ComponentRenderRequest = {
    entryPath: "product/browse/home",
    viewport: "mobile",
    colorScheme: "light",
    revision: 3,
    pageId: "0123456789abcdef0123456789abcdef",
    overrides: {},
  };
  const answer = {
    renderId: "r-1",
    revision: 3,
    previewUrl: "/mokly-viewer/components/renders/r-1/index.html",
    props: { label: ["string", "Go"] },
    usage: richUsage(),
  };
  assert.deepEqual(
    readRenderResponse(extended(answer), request),
    readRenderResponse(answer, request),
  );
});

test("the live descriptor reader ignores additive fields", () => {
  const descriptor = {
    schemaVersion: 3,
    generation: "d4".repeat(32),
    render: { url: "/mokly-viewer/components/render", token: "opaque" },
  };
  assert.deepEqual(readLiveDescriptor(extended(descriptor)), descriptor);
});

test("a field that contradicts its record's own kind stays invalid", () => {
  const detail = rawDetailFixtures().current["components/action"]!;
  const pending = structuredClone(detail);
  (pending.views[0] as Raw).usage = { status: "pending", ranges: [] };
  assert.throws(
    () => readEntryDetail(pending),
    /only ready usage carries records/,
  );
  const page = structuredClone(rawDetailFixtures().current.guide!);
  (page.resourceEvidence!.rules[0]!.owner as Raw).path = "components/action";
  assert.throws(
    () => readEntryDetail(page),
    /an entry owner names no component/,
  );
  const index = rawIndexFixture();
  (index.screens[0]!.changes as Raw) = { status: "pending", kind: "changed" };
  assert.throws(() => readCatalogueIndex(index), /cannot carry ready evidence/);
});

test("an unknown control kind is a new discriminant and fails", () => {
  const index = richIndex();
  const action = index.components.find(
    (entry) => entry.path === "components/action",
  )!;
  (action.controls as Raw).label = { kind: "color", label: "Label" };
  assert.throws(() => readCatalogueIndex(index), /unknown control kind/);
});
