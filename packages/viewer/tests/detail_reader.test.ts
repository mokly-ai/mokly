import assert from "node:assert/strict";
import { test } from "node:test";

import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";

import { rawDetailFixtures } from "./catalogue_v9_fixture.js";

const HASH = "b".repeat(64);
const RETIRED =
  "9222f823b4a0d8a23e201436f42c7d624b675f318bc496b635d18fb9f5a4806e";

type Raw = Record<string, unknown>;

function current(path: string): Raw {
  return rawDetailFixtures().current[path] as unknown as Raw;
}

function removed(): Raw {
  return rawDetailFixtures().removed[RETIRED] as unknown as Raw;
}

function views(detail: Raw): Raw[] {
  return detail.views as Raw[];
}

test("every detail fixture reads back unchanged", () => {
  const fixtures = rawDetailFixtures();
  for (const detail of [
    ...Object.values(fixtures.current),
    ...Object.values(fixtures.removed),
  ]) {
    const copy = readEntryDetail(detail);
    assert.deepEqual(copy, detail);
    assert.notStrictEqual(copy, detail);
    assert.notStrictEqual(copy.identity, detail.identity);
    assert.notStrictEqual(copy.views, detail.views);
  }
});

test("the detail version gate runs before any other field is read", () => {
  for (const value of [
    undefined,
    null,
    [],
    { schemaVersion: 1 },
    { schemaVersion: 2 },
    { schemaVersion: 3 },
    { schemaVersion: 5 },
    { schemaVersion: 0, entry: "not an entry" },
    { ...current("guide"), schemaVersion: "1" },
    { ...current("guide"), schemaVersion: 3 },
    { ...current("components/action"), schemaVersion: 3 },
  ])
    assert.throws(
      () => readEntryDetail(value),
      (error) =>
        error instanceof MoklyVersionError &&
        error.boundary === "detail" &&
        error.supported === 4,
    );
});

test("version 4 permits a current variant without workspace lists", () => {
  const variant = current("components/action/default");
  assert.equal((variant.workspace as Raw).usedBy, undefined);
  assert.equal((variant.workspace as Raw).affected, undefined);
  assert.ok(readEntryDetail(variant).workspace);
});

test("a removed detail copy keeps an omitted workspace", () => {
  const withoutWorkspace = removed();
  delete withoutWorkspace.workspace;
  assert.equal(readEntryDetail(withoutWorkspace).workspace, undefined);
});

test("detail copies accept additive generation and deployment fields", () => {
  const withGeneration = current("product/browse/home");
  withGeneration.generation = HASH;
  assert.doesNotThrow(() => readEntryDetail(withGeneration));
  const removedDeployment = removed();
  removedDeployment.deploymentId = HASH;
  assert.doesNotThrow(() => readEntryDetail(removedDeployment));
});

test("a detail copy keeps pending usage", () => {
  const pending = current("product/browse/home");
  views(pending)[0]!.usage = { status: "pending" };
  assert.deepEqual(readEntryDetail(pending).views[0]!.usage, {
    status: "pending",
  });
});

test("a detail copy keeps evidence records and owners", () => {
  const detail = current("components/action");
  views(detail)[0]!.resourceEvidence = {
    rules: [
      {
        stylesheet: "styles/action.css",
        selector: ".action",
        status: "matched",
        owner: { kind: "component", path: "components/action" },
      },
    ],
    resources: [{ path: "assets/icon.svg", owner: { kind: "entry" } }],
  };
  assert.deepEqual(
    readEntryDetail(structuredClone(detail)).views[0]!.resourceEvidence,
    views(detail)[0]!.resourceEvidence,
  );
});

test("a detail copy keeps workspace links", () => {
  const link = {
    entryPath: "product/browse/home",
    entryKind: "screen",
    title: "Home",
    viewport: "mobile",
    colorScheme: "light",
    instanceKey: HASH,
    direct: true,
    removed: false,
    comparisonEligible: true,
  };
  const detail = current("components/action");
  (detail.workspace as Raw).usedBy = [link];
  assert.deepEqual(readEntryDetail(detail).workspace?.usedBy, [link]);
});

test("a detail copy keeps the view state and base address", () => {
  const home = current("product/browse/home");
  assert.equal(readEntryDetail(home).views[0]?.state, "changed");
  assert.deepEqual(readEntryDetail(home).before?.path, "product/browse/home");
});
