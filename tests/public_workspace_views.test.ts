import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import { removedManifestEntries } from "../dist/registry/changes.js";
import type { ManifestV7 } from "../packages/viewer/dist/registry/types.js";
import type { ReviewResultV4 } from "../packages/viewer/dist/review/component_types.js";
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
    catalogue: createCatalogue(
      componentManifest,
      removedManifestEntries(componentManifest, componentBaseline),
    ),
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
  assert.ok(entry?.kind === "component" && !("variantOf" in entry));
  if (entry?.kind !== "component" || "variantOf" in entry)
    throw new Error("Missing component parent");

  const data = workspaceData(catalogue, { base: "", updateVersion: 1 }, entry);
  assert.deepEqual(data.changedViews["badge-default"], []);
  assert.deepEqual(data.changedViews["badge-second"], [
    { viewport: "mobile", colorScheme: "dark" },
    { viewport: "desktop", colorScheme: "dark" },
  ]);
  assert.deepEqual(data.changedViews["badge-removed"], [
    { viewport: "mobile", colorScheme: "light" },
    { viewport: "mobile", colorScheme: "dark" },
    { viewport: "desktop", colorScheme: "light" },
    { viewport: "desktop", colorScheme: "dark" },
  ]);
  assert.ok(
    data.viewStates["badge-default"]?.every(
      ({ state }) => state === "unchanged",
    ),
  );
  assert.deepEqual(
    data.viewStates["badge-second"]?.map(({ state }) => state),
    ["unchanged", "changed", "unchanged", "changed"],
  );
  assert.ok(
    data.viewStates["badge-removed"]?.every(({ state }) => state === "removed"),
  );
});

test("public workspace derives a screen's ready per-view states", () => {
  const screen = {
    colorSchemes: ["light"] as const,
    declaredDependencies: [],
    description: "Welcome screen",
    id: "welcome",
    kind: "screen" as const,
    navPath: [],
    relatedDocs: [],
    sourcePath: "entries/welcome.mockup.tsx",
    title: "Welcome",
    useCaseIds: [],
  };
  const manifest: ManifestV7 = {
    entries: [screen],
    generatedBy: "mokly",
    schemaVersion: 7,
    sourceFiles: [screen.sourcePath],
  };
  const result: ReviewResultV4 = {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 4,
    screens: [
      {
        after: { id: screen.id, title: screen.title },
        before: { id: screen.id, title: screen.title },
        dependencies: [],
        id: screen.id,
        sharedImpact: [],
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
    sharedImpact: [],
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
