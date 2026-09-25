import assert from "node:assert/strict";
import { test } from "node:test";

import type { CatalogueView } from "../src/catalogue/types.js";
import {
  resolveCatalogueUsageScope,
  type CatalogueUsageScopeTarget,
} from "../src/catalogue/usage_scope.js";

import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

const model = scopedCatalogueFixture();

test("screen routes retain only the selected screen's views", () => {
  const screen = model.screens.find(({ id }) => id === "home")!;
  assertScope({ kind: "target", route: screen.route }, screen.views);
});

test("screen variant routes retain only the selected variant screen", () => {
  const variant = model.screens.find(({ id }) => id === "home-empty")!;
  assert.equal(variant.variantOf, "home");
  assertScope({ kind: "target", route: variant.route }, variant.views);
});

test("component routes retain current and removed saved variants", () => {
  const component = model.components.find(({ id }) => id === "action")!;
  assert.deepEqual(
    component.variants.map(({ id }) => id),
    ["default", "retired"],
  );
  assertScope(
    { kind: "target", route: component.route },
    component.variants.flatMap(({ views }) => views),
  );
});

test("use cases deduplicate repeated step-screen usage", () => {
  const useCase = model.useCases.find(({ id }) => id === "tour")!;
  const screen = model.screens.find(({ id }) => id === "home")!;
  assert.equal(useCase.steps.length, 2);
  assertScope({ kind: "target", route: useCase.route }, screen.views);
});

test("snapshot-selected removed screens retain their exact historical views", () => {
  const record = model.removedEntries.find(
    ({ entry }) => entry.kind === "screen",
  )!;
  assert.ok(record.snapshotId);
  assert.equal(record.entry.kind, "screen");
  assertScope(
    {
      kind: "target",
      route: record.entry.route,
      snapshotId: record.snapshotId,
    },
    record.entry.views,
  );
});

test("snapshot-selected removed components retain all historical variants", () => {
  const record = model.removedEntries.find(
    ({ entry }) => entry.kind === "component",
  )!;
  assert.ok(record.snapshotId);
  assert.equal(record.entry.kind, "component");
  assertScope(
    {
      kind: "target",
      route: record.entry.route,
      snapshotId: record.snapshotId,
    },
    record.entry.variants.flatMap(({ views }) => views),
  );
});

test("page, removed non-usage entries, home and missing retain no usage", () => {
  const page = model.pages[0]!;
  const removedPage = model.removedEntries.find(
    ({ entry }) => entry.kind === "page",
  )!;
  assert.ok(removedPage.snapshotId);
  assertScope({ kind: "target", route: page.route }, []);
  assertScope(
    {
      kind: "target",
      route: removedPage.entry.route,
      snapshotId: removedPage.snapshotId,
    },
    [],
  );
  const removedUseCase = model.removedEntries.find(
    ({ entry }) => entry.kind === "use-case",
  )!;
  assert.ok(removedUseCase.snapshotId);
  assertScope(
    {
      kind: "target",
      route: removedUseCase.entry.route,
      snapshotId: removedUseCase.snapshotId,
    },
    [],
  );
  assertScope({ kind: "home" }, []);
  assertScope({ kind: "missing", requested: "not-here.html" }, []);
});

test("target routes cannot select another snapshot", () => {
  const removed = model.removedEntries.find(
    ({ entry }) => entry.kind === "screen",
  )!;
  assert.throws(() =>
    resolveCatalogueUsageScope(model, {
      kind: "target",
      route: removed.entry.route,
      snapshotId: "f".repeat(64),
    }),
  );
});

function assertScope(
  target: CatalogueUsageScopeTarget,
  expected: readonly CatalogueView[],
): void {
  const scope = resolveCatalogueUsageScope(model, target);
  assert.equal(scope.size, expected.length);
  for (const view of expected) assert.equal(scope.has(view), true);
}
