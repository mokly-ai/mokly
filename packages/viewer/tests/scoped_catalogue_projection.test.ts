import assert from "node:assert/strict";
import { test } from "node:test";

import { projectScopedCatalogue } from "../src/catalogue/scoped_projection.js";
import { catalogueUsageViews } from "../src/catalogue/usage_scope.js";
import { serializeShellBootstrap } from "../src/standalone/bootstrap.js";

import { scopedCatalogueFixture } from "./scoped_catalogue_fixture.js";

const model = scopedCatalogueFixture();
const context = {
  base: "origin/main",
  comparisons: true,
  updateVersion: 7,
};

test("projection retains real route usage and omits every other view", () => {
  const screen = model.screens.find(({ id }) => id === "home")!;
  const projected = projectScopedCatalogue(model, {
    kind: "target",
    route: screen.route,
  });
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
  changed.components[0]!.variants[0]!.views[0]!.usage = {
    status: "pending",
  };
  assert.notDeepEqual(
    changed.components[0]!.variants[0]!.views[0]!.usage,
    model.components[0]!.variants[0]!.views[0]!.usage,
  );
  assert.equal(
    scopedBytes(model, { kind: "target", route: screen.route }),
    scopedBytes(changed, { kind: "target", route: screen.route }),
  );
});

test("synthetic component bytes ignore another entry's usage", () => {
  const component = model.components.find(({ id }) => id === "action")!;
  const changed = structuredClone(model);
  changed.screens[0]!.views[0]!.usage = { status: "unavailable" };
  assert.notDeepEqual(
    changed.screens[0]!.views[0]!.usage,
    model.screens[0]!.views[0]!.usage,
  );
  assert.equal(
    scopedBytes(model, { kind: "target", route: component.route }),
    scopedBytes(changed, { kind: "target", route: component.route }),
  );
});

function scopedBytes(
  catalogue: typeof model,
  view:
    | { kind: "home" }
    | { kind: "missing"; requested: string }
    | { kind: "target"; route: string },
): string {
  return serializeShellBootstrap({
    catalogue: projectScopedCatalogue(catalogue, view),
    context,
    view,
  });
}
