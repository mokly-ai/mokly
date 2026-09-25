import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import type { ManifestV6 } from "../packages/viewer/dist/registry/types.js";
import type { ReviewResultV5 } from "../packages/viewer/dist/review/component_types.js";
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
  assert.ok(
    data.viewStates.default?.every(({ state }) => state === "unchanged"),
  );
  assert.deepEqual(
    data.viewStates.second?.map(({ state }) => state),
    ["unchanged", "changed", "unchanged", "changed"],
  );
  assert.ok(data.viewStates.removed?.every(({ state }) => state === "removed"));
});

test("public workspace derives a screen's ready per-view states", () => {
  const screen = {
    description: "Welcome screen",
    fragments: {
      desktop: "screens/welcome.desktop.html",
      mobile: "screens/welcome.mobile.html",
    },
    id: "welcome",
    kind: "screen" as const,
    navPath: [],
    relatedDocs: [],
    route: "screens/welcome.html",
    sourcePath: "entries/welcome.mockup.tsx",
    title: "Welcome",
    useCaseIds: [],
    viewports: ["mobile", "desktop"] as const,
  };
  const manifest: ManifestV6 = {
    entries: [screen],
    generatedBy: "mokly",
    schemaVersion: 6,
    sourceFiles: [screen.sourcePath],
  };
  const result: ReviewResultV5 = {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 5,
    screens: [
      {
        id: screen.id,
        route: screen.route,
        state: "changed",
        title: screen.title,
        views: [
          {
            colorScheme: "light",
            ignoredIds: [],
            state: "changed",
            viewport: "mobile",
          },
          {
            colorScheme: "light",
            ignoredIds: [],
            state: "unchanged",
            viewport: "desktop",
          },
        ],
      },
    ],
  };
  const model = projectCatalogue({
    catalogue: createCatalogue(manifest),
    changesStatus: "ready",
    comparison: result,
    comparisonUrl: null,
    configPath: "mokly.config.ts",
    revision: { content: 0, evidence: 1 },
  });
  const catalogue = viewerCatalogue(model);
  const entry = catalogue.byId.get(screen.id);
  assert.equal(entry?.kind, "screen");
  assert.ok(entry?.kind === "screen");

  const data = workspaceData(catalogue, { base: "", updateVersion: 1 }, entry);
  assert.deepEqual(data.viewStates, {
    welcome: [
      { colorScheme: "light", state: "changed", viewport: "mobile" },
      { colorScheme: "light", state: "unchanged", viewport: "desktop" },
    ],
  });
});
