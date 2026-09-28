import assert from "node:assert/strict";
import test from "node:test";

import {
  entryRoute,
  generatedViews,
  parseRemovedPagePreview,
  parseReviewResult,
  viewRoute,
} from "@mokly/viewer/data";

import {
  parseHistoricalManifest,
  parseManifest,
} from "../src/registry/manifest.js";

const sourcePath = "entries/home.mockup.tsx";

function currentScreen() {
  return {
    address: "/home",
    colorSchemes: ["light"] as const,
    declaredDependencies: [] as string[],
    description: "Home",
    id: "home",
    kind: "screen" as const,
    navPath: [] as string[],
    relatedDocs: [] as string[],
    sourcePath,
    title: "Home",
    useCaseIds: [] as string[],
  };
}

function currentManifest() {
  return {
    entries: [currentScreen()],
    generatedBy: "mokly" as const,
    schemaVersion: 7 as const,
    sourceFiles: [sourcePath],
  };
}

test("manifest v7 carries identity and configuration but no derived paths", () => {
  const parsed = parseManifest(currentManifest());
  assert.deepEqual(parsed, currentManifest());

  for (const [field, value] of [
    ["route", entryRoute("screen", "home")],
    ["fragments", { mobile: "home.mobile.html", desktop: "home.html" }],
    ["darkFragments", { mobile: "dark-mobile.html", desktop: "dark.html" }],
    ["viewports", ["mobile", "desktop"]],
    ["dependencies", [sourcePath]],
  ] as const) {
    const manifest = currentManifest() as Record<string, unknown> & {
      entries: Record<string, unknown>[];
    };
    manifest.entries[0] = { ...manifest.entries[0], [field]: value };
    assert.throws(
      () => parseManifest(manifest),
      new RegExp(`unsupported ${field}`),
    );
  }
});

test("historical parsing accepts only v7 and derives its view paths", () => {
  assert.throws(
    () => parseHistoricalManifest({ schemaVersion: 6 }),
    (error: unknown) =>
      (error as { code?: string }).code === "baseline-incompatible-earlier",
  );
  const current = parseHistoricalManifest(currentManifest());
  const [entry] = current.entries;
  assert.ok(entry?.kind === "screen");
  assert.deepEqual(
    generatedViews(entry).map(({ path }) => path),
    [
      viewRoute("screen", "home", "mobile", "light"),
      viewRoute("screen", "home", "desktop", "light"),
    ],
  );
});

test("review v4 is the only accepted comparison result", () => {
  const result = {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "origin/main",
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 4,
    screens: [],
    sharedImpact: [],
  };
  assert.deepEqual(parseReviewResult(result), result);
  assert.throws(
    () => parseReviewResult({ ...result, schemaVersion: 3 }),
    /unsupported schemaVersion/,
  );
});

test("removed page preview schema 2 carries only page identity", () => {
  const preview = {
    schemaVersion: 2,
    baseRef: "origin/main",
    baseCommit: "b".repeat(40),
    id: "guide",
  };
  assert.deepEqual(parseRemovedPagePreview(preview), preview);
});
