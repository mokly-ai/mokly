import assert from "node:assert/strict";
import { test } from "node:test";

import { readEntryDetail } from "../src/catalogue/detail_reader.js";
import { MoklyVersionError } from "../src/catalogue/version_error.js";

import { rawDetailFixtures } from "./catalogue_v7_fixture.js";

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
    { schemaVersion: 2 },
    { schemaVersion: 0, entry: "not an entry" },
    { ...current("guide"), schemaVersion: "1" },
  ])
    assert.throws(
      () => readEntryDetail(value),
      (error) =>
        error instanceof MoklyVersionError &&
        error.boundary === "detail" &&
        error.supported === 1,
    );
});

test("a current detail has deployment and revision, a removed one generation and snapshot", () => {
  const withGeneration = current("product/browse/home");
  withGeneration.generation = HASH;
  rejects(withGeneration, /current and removed fences are exclusive/);
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
  rejects(removedDeployment, /current and removed fences are exclusive/);
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
