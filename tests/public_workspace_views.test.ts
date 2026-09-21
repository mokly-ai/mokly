import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { workspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { viewerCatalogue } from "../packages/viewer/dist/viewer/projection.js";

import {
  component,
  componentBaseline,
  componentManifest,
  componentVariantResult,
} from "./helpers/workspace_views_data_fixture.js";

test("public workspace keeps each saved variant's changed views", () => {
  const result = componentVariantResult();
  const model = projectCatalogue({
    catalogue: createCatalogue(componentManifest),
    changesStatus: "ready",
    comparison: result,
    comparisonUrl: null,
    configPath: "mokly.config.ts",
    evidence: { baseline: componentBaseline, result },
    revision: { content: 0, evidence: 1 },
  });
  const catalogue = viewerCatalogue(model);
  const entry = catalogue.byId.get(component.id);
  assert.equal(entry?.kind, "component");
  assert.ok(entry?.kind === "component");

  const data = workspaceData(catalogue, { base: "", updateVersion: 1 }, entry);
  assert.deepEqual(data.changedViews.default, []);
  assert.deepEqual(data.changedViews.second, [
    { viewport: "mobile", colorScheme: "dark" },
    { viewport: "desktop", colorScheme: "dark" },
  ]);
  assert.deepEqual(data.changedViews.removed, [
    { viewport: "mobile", colorScheme: "light" },
    { viewport: "mobile", colorScheme: "dark" },
    { viewport: "desktop", colorScheme: "light" },
    { viewport: "desktop", colorScheme: "dark" },
  ]);
});
