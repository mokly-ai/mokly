import assert from "node:assert/strict";
import { test } from "node:test";

import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { readCatalogueIndex } from "../src/catalogue/index_reader.js";
import { readLiveDescriptor } from "../src/catalogue/live_reader.js";
import type { CatalogueReadModel } from "../src/catalogue/types.js";

import { rawDetailFixtures, rawIndexFixture } from "./catalogue_v7_fixture.js";

type Raw = Record<string, unknown>;

/** Add one field a newer writer might add to a record. */
function extend(record: unknown): void {
  (record as Raw).later = { added: true };
}

test("the index reader ignores additive fields at every depth", () => {
  const raw = rawIndexFixture();
  const plain = readCatalogueIndex(structuredClone(raw));
  const edited = structuredClone(raw) as CatalogueReadModel & Raw;
  edited.live = { generation: "c3".repeat(32) };
  const live = readCatalogueIndex(structuredClone(edited));
  extend(edited);
  extend(edited.identity);
  extend(edited.live);
  extend(edited.tree[0]);
  for (const entry of [
    ...edited.screens,
    ...edited.pages,
    ...edited.documents,
    ...edited.useCases,
    ...edited.components,
  ]) {
    extend(entry);
    extend(entry.details);
    extend(entry.changes);
    if ("views" in entry)
      for (const view of entry.views) {
        extend(view);
        extend(view.comparison);
      }
    if ("documentKeys" in entry)
      for (const key of entry.documentKeys) extend(key);
    if ("steps" in entry) for (const step of entry.steps) extend(step);
    if ("controls" in entry)
      for (const control of Object.values(entry.controls)) extend(control);
  }
  for (const removed of edited.removedEntries) {
    extend(removed);
    extend(removed.entry);
    if (removed.preview) extend(removed.preview);
  }
  (edited.screens[0] as Raw).preview = { kind: "screen" };
  assert.deepEqual(readCatalogueIndex(edited), live);
  assert.equal(plain.live, undefined);
});

test("the detail reader ignores additive fields at every depth", () => {
  for (const raw of [
    ...Object.values(rawDetailFixtures().current),
    ...Object.values(rawDetailFixtures().removed),
  ]) {
    const plain = readEntryDetail(structuredClone(raw));
    const edited = structuredClone(raw) as typeof raw & Raw;
    extend(edited);
    extend(edited.identity);
    extend(edited.entry);
    for (const view of edited.views) {
      extend(view);
      extend(view.usage);
      if (view.usage.status === "ready") {
        for (const range of view.usage.ranges) {
          extend(range);
          extend(range.target);
        }
      }
      if (view.resourceEvidence) extend(view.resourceEvidence);
    }
    if (edited.resourceEvidence) {
      extend(edited.resourceEvidence);
      for (const rule of edited.resourceEvidence.rules) {
        extend(rule);
        extend(rule.owner);
      }
    }
    if (edited.workspace) extend(edited.workspace);
    assert.deepEqual(readEntryDetail(edited), plain);
  }
});

test("workspace links and input changes ignore additive fields", () => {
  const raw = rawDetailFixtures().current["components/action"]!;
  const link = {
    entryPath: "product/browse/home",
    entryKind: "screen" as const,
    title: "Home",
    viewport: "mobile" as const,
    colorScheme: "light" as const,
    instanceKey: "e5".repeat(32),
    direct: true,
    removed: false,
    comparisonEligible: true,
  };
  const change = {
    instanceId: "action",
    title: "Action",
    viewport: "mobile" as const,
    colorScheme: "light" as const,
    before: {},
    after: {},
  };
  const plain = structuredClone(raw);
  plain.workspace!.usedBy = [link];
  plain.workspace!.inputChanges = [change];
  const edited = structuredClone(raw);
  edited.workspace!.usedBy = [{ ...link, later: 1 } as typeof link];
  edited.workspace!.inputChanges = [{ ...change, later: 1 } as typeof change];
  assert.deepEqual(readEntryDetail(edited), readEntryDetail(plain));
});

test("the live descriptor reader ignores additive fields", () => {
  const descriptor = {
    schemaVersion: 3,
    generation: "d4".repeat(32),
    render: { url: "/mokly-viewer/components/render", token: "opaque" },
  };
  assert.deepEqual(
    readLiveDescriptor({
      ...descriptor,
      later: 1,
      render: { ...descriptor.render, method: "POST" },
    }),
    descriptor,
  );
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
