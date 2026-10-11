import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogue } from "../dist/catalogue/projection.js";
import { removedManifestEntries } from "../dist/registry/changes.js";
import type { ManifestV10 } from "../packages/viewer/dist/registry/types.js";
import type { ReviewResultV7 } from "../packages/viewer/dist/review/component_types.js";
import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { workspaceData } from "../packages/viewer/dist/shell/workspace_data.js";
import { viewerCatalogue } from "../packages/viewer/dist/viewer/projection.js";

import { currentManifest } from "./helpers/current_manifest.js";
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
  const entry = catalogue.byPath.get(component.path);
  assert.equal(entry?.kind, "component");
  assert.ok(entry?.kind === "component" && !("variantOf" in entry));
  if (entry?.kind !== "component" || "variantOf" in entry)
    throw new Error("Missing component parent");

  const data = workspaceData(catalogue, { base: "", updateVersion: 1 }, entry);
  assert.deepEqual(data.changedViews["badge/default"], []);
  assert.deepEqual(data.changedViews["badge/second"], [
    { viewport: "mobile", colorScheme: "dark" },
    { viewport: "desktop", colorScheme: "dark" },
  ]);
  assert.deepEqual(data.changedViews["badge/removed"], [
    { viewport: "mobile", colorScheme: "light" },
    { viewport: "mobile", colorScheme: "dark" },
    { viewport: "desktop", colorScheme: "light" },
    { viewport: "desktop", colorScheme: "dark" },
  ]);
  assert.ok(
    data.viewStates["badge/default"]?.every(
      ({ state }) => state === "unchanged",
    ),
  );
  assert.deepEqual(
    data.viewStates["badge/second"]?.map(({ state }) => state),
    ["unchanged", "changed", "unchanged", "changed"],
  );
  assert.ok(
    data.viewStates["badge/removed"]?.every(({ state }) => state === "removed"),
  );
});

test("public workspace derives a screen's ready per-view states", () => {
  const screen = {
    colorSchemes: ["light"] as const,
    description: "Welcome screen",
    path: "welcome",
    kind: "screen" as const,

    relatedDocs: [],
    sourcePath: "entries/welcome.mockup.tsx",
    title: "Welcome",
    useCasePaths: [],
  };
  const manifest: ManifestV10 = currentManifest({
    entries: [screen],
    folders: [],
    generatedBy: "mokly",
    schemaVersion: 10,
    sourceFiles: [screen.sourcePath],
  });
  const result: ReviewResultV7 = {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "main",
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 7 as const,
    screens: [
      {
        after: { path: screen.path, title: screen.title },
        before: { path: screen.path, title: screen.title },
        path: screen.path,
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
  const entry = catalogue.byPath.get(screen.path);
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
