import assert from "node:assert/strict";
import { test } from "node:test";

import { projectScopedCatalogue } from "../src/catalogue/scoped_projection.js";
import type { CatalogueRecord } from "../src/catalogue/types.js";
import { catalogueUsageViews } from "../src/catalogue/usage_scope.js";
import {
  serializeShellBootstrap,
  type ShellBootstrapView,
} from "../src/standalone/bootstrap.js";

import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

const model = scopedCatalogueFixture();
const context = {
  base: "origin/main",
  comparisons: true,
  updateVersion: 7,
};

test("projection retains real route usage and omits every other view", () => {
  const screen = model.screens.find(({ id }) => id === "home")!;
  const projected = projectScopedCatalogue(model, target(screen));
  const projectedScreen = projected.screens.find(({ id }) => id === screen.id)!;
  assert.deepEqual(
    projectedScreen.views.map(({ usage }) => usage),
    screen.views.map(({ usage }) => usage),
  );
  const retained = new Set(projectedScreen.views);
  for (const view of catalogueUsageViews(projected))
    if (!retained.has(view))
      assert.deepEqual(view.usage, { status: "omitted" });
});

test("synthetic screen bytes ignore another entry's usage", () => {
  const screen = model.screens.find(({ id }) => id === "home")!;
  const changed = structuredClone(model);
  const changedVariant = changed.components.find(
    (entry) => "variantOf" in entry,
  )!;
  const originalVariant = model.components.find(
    (entry) => "variantOf" in entry,
  )!;
  changedVariant.views[0]!.usage = {
    status: "pending",
  };
  assert.notDeepEqual(
    changedVariant.views[0]!.usage,
    originalVariant.views[0]!.usage,
  );
  assert.equal(
    scopedBytes(model, target(screen)),
    scopedBytes(changed, target(screen)),
  );
});

test("synthetic component bytes ignore another entry's usage", () => {
  const component = model.components.find(
    (entry) => entry.id === "action" && !("variantOf" in entry),
  )!;
  const changed = structuredClone(model);
  changed.screens[0]!.views[0]!.usage = { status: "unavailable" };
  assert.notDeepEqual(
    changed.screens[0]!.views[0]!.usage,
    model.screens[0]!.views[0]!.usage,
  );
  assert.equal(
    scopedBytes(model, target(component)),
    scopedBytes(changed, target(component)),
  );
});

function scopedBytes(
  catalogue: typeof model,
  view: ShellBootstrapView,
): string {
  return serializeShellBootstrap({
    catalogue: projectScopedCatalogue(catalogue, view),
    context,
    view,
  });
}

function target(entry: Pick<CatalogueRecord, "id" | "kind">) {
  return {
    kind: "target" as const,
    entryId: entry.id,
    entryKind: entry.kind,
  };
}
