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

function rejects(detail: Raw, reason: RegExp): void {
  assert.throws(
    () => readEntryDetail(detail),
    (error) =>
      !(error instanceof MoklyVersionError) &&
      error instanceof Error &&
      reason.test(error.message),
  );
}

function views(detail: Raw): Raw[] {
  return detail.views as Raw[];
}

test("every detail fixture reads back unchanged", () => {
  const fixtures = rawDetailFixtures();
  for (const detail of [
    ...Object.values(fixtures.current),
    ...Object.values(fixtures.removed),
  ])
    assert.deepEqual(readEntryDetail(structuredClone(detail)), detail);
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
  ])
    assert.throws(
      () => readEntryDetail(value),
      (error) =>
        error instanceof MoklyVersionError &&
        error.boundary === "detail" &&
        error.supported === 4,
    );
});

test("visual details require a unique control order and other kinds omit it", () => {
  const missing = current("components/action");
  delete missing.controlOrder;
  rejects(missing, /control order/);
  const duplicate = current("components/action");
  duplicate.controlOrder = ["label", "label"];
  rejects(duplicate, /control order repeats/);
  const page = current("guide");
  page.controlOrder = [];
  rejects(page, /control order/);
});

test("version 4 permits a current variant without workspace lists", () => {
  const variant = current("components/action/default");
  assert.equal((variant.workspace as Raw).usedBy, undefined);
  assert.equal((variant.workspace as Raw).affected, undefined);
  assert.ok(readEntryDetail(variant).workspace);
  const old = current("components/action");
  old.schemaVersion = 3;
  assert.throws(
    () => readEntryDetail(old),
    (error) => error instanceof MoklyVersionError && error.supported === 4,
  );
});

test("removed visual details require both workspace lists", () => {
  const withoutWorkspace = removed();
  delete withoutWorkspace.workspace;
  assert.equal(readEntryDetail(withoutWorkspace).workspace, undefined);
  const missing = removed();
  delete (missing.workspace as Raw).usedBy;
  rejects(missing, /removed visual details require workspace lists/);
});

test("a current detail has revision, a removed one snapshot and no deployment fence", () => {
  const withGeneration = current("product/browse/home");
  withGeneration.generation = HASH;
  assert.doesNotThrow(() => readEntryDetail(withGeneration));
  const withoutRevision = current("product/browse/home");
  delete withoutRevision.revision;
  rejects(withoutRevision, /current and removed fences are exclusive/);
  const withSnapshot = current("product/browse/home");
  (withSnapshot.entry as Raw).snapshotId = HASH;
  rejects(withSnapshot, /current and removed fences are exclusive/);
  const removedWithRevision = removed();
  removedWithRevision.revision = 0;
  rejects(removedWithRevision, /current and removed fences are exclusive/);
  const removedWithoutSnapshot = removed();
  delete (removedWithoutSnapshot.entry as Raw).snapshotId;
  rejects(removedWithoutSnapshot, /current and removed fences are exclusive/);
  const removedDeployment = removed();
  removedDeployment.deploymentId = HASH;
  assert.doesNotThrow(() => readEntryDetail(removedDeployment));
});

test("views, the workspace and entry evidence belong to their kinds", () => {
  const pageViews = current("guide");
  pageViews.views = views(current("product/browse/home"));
  rejects(pageViews, /only screens and components have views/);
  const useCaseWorkspace = current("tour");
  useCaseWorkspace.workspace = current("product/browse/home").workspace;
  rejects(useCaseWorkspace, /only screens and components have a workspace/);
  const screenEvidence = current("product/browse/home");
  screenEvidence.resourceEvidence = { rules: [], resources: [] };
  rejects(screenEvidence, /only a page carries entry resource evidence/);
});

test("usage is ready with its records, or pending or unavailable alone", () => {
  const pending = current("product/browse/home");
  views(pending)[0]!.usage = { status: "pending" };
  assert.deepEqual(readEntryDetail(pending).views[0]!.usage, {
    status: "pending",
  });
  const omitted = current("product/browse/home");
  views(omitted)[0]!.usage = { status: "omitted" };
  rejects(omitted, /unsupported discriminant/);
  const leaked = current("product/browse/home");
  views(leaked)[0]!.usage = { status: "pending", instances: [] };
  rejects(leaked, /only ready usage carries records/);
  const missing = current("product/browse/home");
  delete views(missing)[0]!.usage;
  rejects(missing, /expected an object/);
});

test("evidence records carry rules and resources with owners", () => {
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
  const extra = structuredClone(detail);
  (views(extra)[0]!.resourceEvidence as Raw).styles = [];
  rejects(extra, /styles is not public catalogue data/);
  const status = structuredClone(detail);
  ((views(status)[0]!.resourceEvidence as Raw).rules as Raw[])[0]!.status =
    "used";
  rejects(status, /unsupported discriminant/);
  const owner = structuredClone(detail);
  ((views(owner)[0]!.resourceEvidence as Raw).resources as Raw[])[0]!.owner = {
    kind: "entry",
    path: "components/action",
  };
  rejects(owner, /an entry owner names no component/);
  const escape = structuredClone(detail);
  ((views(escape)[0]!.resourceEvidence as Raw).resources as Raw[])[0]!.path =
    "../outside.css";
  rejects(escape, /expected repository-relative path/);
});

test("a detail rejects private evidence but keeps public resources", () => {
  const detail = current("product/browse/home");
  views(detail)[0]!.sourceFiles = [];
  rejects(detail, /sourceFiles is not public catalogue data/);
  const token = current("product/browse/home");
  token.token = "secret";
  rejects(token, /token is not public catalogue data/);
});

test("workspace links name a visual entry and an instance key", () => {
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
  const page = current("components/action");
  (page.workspace as Raw).usedBy = [{ ...link, entryKind: "page" }];
  rejects(page, /unsupported discriminant/);
  const key = current("components/action");
  (key.workspace as Raw).affected = [{ ...link, instanceKey: "short" }];
  rejects(key, /invalid identity/);
});

test("view states and ignore ids travel with evidence, and a base belongs to a current visual entry", () => {
  const home = current("product/browse/home");
  assert.equal(readEntryDetail(home).views[0]?.state, "changed");
  assert.deepEqual(readEntryDetail(home).before?.path, "product/browse/home");
  for (const field of ["state", "ignoredIds", "resourceEvidence"]) {
    const detail = current("product/browse/home");
    delete views(detail)[0]![field];
    rejects(detail, /state and ignore ids travel with evidence/);
  }
  for (const ids of [
    ["b", "a"],
    ["a", "a"],
  ]) {
    const detail = current("product/browse/home");
    views(detail)[0]!.ignoredIds = ids;
    rejects(detail, /sorted and unique/);
  }
  const invalid = current("product/browse/home");
  views(invalid)[0]!.ignoredIds = ["Hero"];
  rejects(invalid, /invalid ignore id/);
  const slotted = current("product/browse/home");
  (slotted.before as Raw).suppliedSlots = [];
  rejects(slotted, /only a component supplies slots/);
  const historical = removed();
  historical.before = { path: "product/browse/home/retired", title: "Retired" };
  rejects(historical, /only a current screen or component has a base/);
  const guide = current("guide");
  guide.before = { path: "guide", title: "Guide" };
  rejects(guide, /only a current screen or component has a base/);
});
