import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  CurrentPath,
  BranchPointPath,
} from "../src/catalogue/path_types.js";
import type { CatalogueRecord, CatalogueView } from "../src/catalogue/types.js";
import {
  resolveCatalogueUsageScope,
  type CatalogueUsageScopeTarget,
} from "../src/catalogue/usage_scope.js";

import { fixtureVariantsAt } from "./path_fixture.js";
import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

const model = scopedCatalogueFixture();

test("screen entries retain only the selected screen's views", () => {
  const screen = model.screens.find(
    ({ path: id }) => id === "product/browse/home",
  )!;
  assertScope(target(screen), screen.views);
});

test("screen variants retain only the selected variant screen", () => {
  const variant = model.screens.find(
    ({ path: id }) => id === "product/browse/home/empty",
  )!;
  assert.equal(variant.variantOf, "product/browse/home");
  assertScope(target(variant), variant.views);
});

test("component entries retain current and removed saved variants", () => {
  const component = model.components.find(
    (entry) => entry.path === "components/action" && !("variantOf" in entry),
  )!;
  const variants = fixtureVariantsAt(model, component.path);
  assert.deepEqual(
    variants.map(({ path: id }) => id),
    ["components/action/default", "components/action/retired"],
  );
  assertScope(
    target(component),
    variants.flatMap<CatalogueView<CurrentPath | BranchPointPath>>(
      ({ views }) => views,
    ),
  );
  assertScope(
    target(variants[0]!),
    variants.flatMap<CatalogueView<CurrentPath | BranchPointPath>>(
      ({ views }) => views,
    ),
  );
});

test("use cases deduplicate repeated step-screen usage", () => {
  const useCase = model.useCases.find(({ path: id }) => id === "tour")!;
  const screen = model.screens.find(
    ({ path: id }) => id === "product/browse/home",
  )!;
  assert.equal(useCase.steps.length, 3);
  const details = model.screens.find(
    (entry) => entry.path === "product/browse/details",
  )!;
  assertScope(target(useCase), [...screen.views, ...details.views]);
});

test("snapshot-selected removed screens retain their exact historical views", () => {
  const record = model.removedEntries.find(
    ({ entry }) => entry.kind === "screen",
  )!;
  assert.ok(record.snapshotId);
  assert.equal(record.entry.kind, "screen");
  assertScope(
    { ...target(record.entry), snapshotId: record.snapshotId },
    record.entry.views,
  );
});

test("snapshot-selected removed components retain their historical variants", () => {
  const record = model.removedEntries.find(
    ({ entry }) => entry.path === "removed-action",
  )!;
  assert.ok(record.snapshotId);
  assert.equal(record.entry.kind, "component");
  const variants = fixtureVariantsAt(model, record.entry.path);
  assertScope(
    { ...target(record.entry), snapshotId: record.snapshotId },
    variants.flatMap<CatalogueView<CurrentPath | BranchPointPath>>(
      ({ views }) => views,
    ),
  );
});

test("page, removed non-usage entries, home and missing retain no usage", () => {
  const page = model.pages[0]!;
  const removedPage = model.removedEntries.find(
    ({ entry }) => entry.kind === "page",
  )!;
  assert.ok(removedPage.snapshotId);
  assertScope(target(page), []);
  assertScope(
    { ...target(removedPage.entry), snapshotId: removedPage.snapshotId },
    [],
  );
  const removedUseCase = model.removedEntries.find(
    ({ entry }) => entry.kind === "use-case",
  )!;
  assert.ok(removedUseCase.snapshotId);
  assertScope(
    { ...target(removedUseCase.entry), snapshotId: removedUseCase.snapshotId },
    [],
  );
  assertScope({ kind: "home" }, []);
  assertScope({ kind: "missing", requested: "not-here" }, []);
});

test("target entries cannot select another snapshot", () => {
  const removed = model.removedEntries.find(
    ({ entry }) => entry.kind === "screen",
  )!;
  assert.throws(() =>
    resolveCatalogueUsageScope(model, {
      ...target(removed.entry),
      snapshotId: "f".repeat(64),
    }),
  );
});

function target(entry: Pick<CatalogueRecord, "path" | "kind">) {
  return {
    kind: "target" as const,
    entryPath: entry.path,
    entryKind: entry.kind,
  };
}

function assertScope(
  scopeTarget: CatalogueUsageScopeTarget,
  expected: readonly CatalogueView<CurrentPath | BranchPointPath>[],
): void {
  const scope = resolveCatalogueUsageScope(model, scopeTarget);
  assert.equal(scope.size, expected.length);
  for (const view of expected) assert.equal(scope.has(view), true);
}
