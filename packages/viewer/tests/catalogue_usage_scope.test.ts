import assert from "node:assert/strict";
import { test } from "node:test";

import { catalogueComponentVariants } from "../src/catalogue/entry_selection.js";
import type { CatalogueRecord, CatalogueView } from "../src/catalogue/types.js";
import {
  resolveCatalogueUsageScope,
  type CatalogueUsageScopeTarget,
} from "../src/catalogue/usage_scope.js";

import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

const model = scopedCatalogueFixture();

test("screen entries retain only the selected screen's views", () => {
  const screen = model.screens.find(({ id }) => id === "home")!;
  assertScope(target(screen), screen.views);
});

test("screen variants retain only the selected variant screen", () => {
  const variant = model.screens.find(({ id }) => id === "home-empty")!;
  assert.equal(variant.variantOf, "home");
  assertScope(target(variant), variant.views);
});

test("component entries retain current and removed saved variants", () => {
  const component = model.components.find(
    (entry) => entry.id === "action" && !("variantOf" in entry),
  )!;
  const variants = catalogueComponentVariants(model, component.id);
  assert.deepEqual(
    variants.map(({ id }) => id),
    ["action-default", "action-retired"],
  );
  assertScope(
    target(component),
    variants.flatMap(({ views }) => views),
  );
  assertScope(
    target(variants[0]!),
    variants.flatMap(({ views }) => views),
  );
});

test("use cases deduplicate repeated step-screen usage", () => {
  const useCase = model.useCases.find(({ id }) => id === "tour")!;
  const screen = model.screens.find(({ id }) => id === "home")!;
  assert.equal(useCase.steps.length, 2);
  assertScope(target(useCase), screen.views);
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
    ({ entry }) => entry.id === "removed-action",
  )!;
  assert.ok(record.snapshotId);
  assert.equal(record.entry.kind, "component");
  const variants = catalogueComponentVariants(model, record.entry.id);
  assertScope(
    { ...target(record.entry), snapshotId: record.snapshotId },
    variants.flatMap(({ views }) => views),
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

function target(entry: Pick<CatalogueRecord, "id" | "kind">) {
  return { kind: "target" as const, entryId: entry.id, entryKind: entry.kind };
}

function assertScope(
  scopeTarget: CatalogueUsageScopeTarget,
  expected: readonly CatalogueView[],
): void {
  const scope = resolveCatalogueUsageScope(model, scopeTarget);
  assert.equal(scope.size, expected.length);
  for (const view of expected) assert.equal(scope.has(view), true);
}
