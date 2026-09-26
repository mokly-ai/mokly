import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import {
  projectScopedCatalogue,
  readScopedShellBootstrap,
  serializeShellBootstrap,
} from "../packages/viewer/dist/runtime.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import type { ShellBootstrapView } from "../packages/viewer/dist/standalone/bootstrap.js";

const manifest = JSON.parse(
  fs.readFileSync("examples/basic/generated/mokly-manifest.json", "utf8"),
);
const model = projectCatalogue({
  catalogue: createCatalogue(manifest),
  changesStatus: "disabled",
  comparisonUrl: null,
  configPath: "examples/basic/mokly.config.ts",
  revision: { content: 0, evidence: 0 },
});
const context = {
  base: "origin/main",
  comparisons: false,
  updateVersion: 0,
};

test("real example scoped bytes ignore another entry's usage", () => {
  const view = { kind: "target" as const, route: "screens/welcome.html" };
  const changed = structuredClone(model);
  changed.components[0]!.variants[0]!.views[0]!.usage = {
    status: "pending",
  };
  assert.notDeepEqual(
    changed.components[0]!.variants[0]!.views[0]!.usage,
    model.components[0]!.variants[0]!.views[0]!.usage,
  );
  assert.equal(scopedBytes(model, view), scopedBytes(changed, view));
});

test("the largest real example scoped bootstrap passes the strict reader", () => {
  const largest = allViews()
    .map((view) => ({ bytes: scopedBytes(model, view), view }))
    .sort(
      (left, right) =>
        Buffer.byteLength(right.bytes) - Buffer.byteLength(left.bytes),
    )[0]!;
  const parsed = readScopedShellBootstrap(JSON.parse(largest.bytes));
  assert.equal(serializeShellBootstrap(parsed), largest.bytes);
  assert.equal(parsed.view.kind, largest.view.kind);
  if (parsed.view.kind === "target" && largest.view.kind === "target")
    assert.equal(parsed.view.route, largest.view.route);
});

function allViews(): readonly ShellBootstrapView[] {
  return [
    { kind: "home" },
    ...model.screens.map(({ route }) => ({ kind: "target" as const, route })),
    ...model.pages.map(({ route }) => ({ kind: "target" as const, route })),
    ...model.useCases.map(({ route }) => ({ kind: "target" as const, route })),
    ...model.components.map(({ route }) => ({
      kind: "target" as const,
      route,
    })),
  ];
}

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
