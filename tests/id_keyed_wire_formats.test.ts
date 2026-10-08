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

import { currentManifest } from "./helpers/current_manifest.js";

const sourcePath = "entries/home.mockup.tsx";

function currentScreen() {
  return {
    address: "/home",
    colorSchemes: ["light"] as const,
    description: "Home",
    path: "home",
    kind: "screen" as const,

    relatedDocs: [] as string[],
    sourcePath,
    title: "Home",
    useCasePaths: [] as string[],
  };
}

function identityManifest() {
  return currentManifest({
    entries: [currentScreen()],
    generatedBy: "mokly" as const,
    schemaVersion: 10 as const,
    folders: [],
    sourceFiles: [sourcePath],
  });
}

test("manifest v10 carries paths and configuration but no derived artifact names", () => {
  const parsed = parseManifest(identityManifest());
  assert.deepEqual(parsed, identityManifest());
  assert.throws(
    () => parseManifest({ ...identityManifest(), schemaVersion: 7 }),
    {
      code: "manifest-invalid",
      message:
        "[mokly/manifest-invalid] expected Mokly manifest schema version 10; run mokly build",
    },
  );

  for (const [field, value] of [
    ["id", "home"],
    ["navPath", ["Home"]],
    ["useCaseIds", []],
    ["route", entryRoute("home")],
    ["fragments", { mobile: "home.mobile.html", desktop: "home.html" }],
    ["darkFragments", { mobile: "dark-mobile.html", desktop: "dark.html" }],
    ["viewports", ["mobile", "desktop"]],
    ["dependencies", [sourcePath]],
  ] as const) {
    const manifest = identityManifest() as Record<string, unknown> & {
      entries: Record<string, unknown>[];
    };
    manifest.entries[0] = { ...manifest.entries[0], [field]: value };
    assert.throws(
      () => parseManifest(manifest),
      new RegExp(`unsupported ${field}`),
    );
  }
});

test("baseline parsing rejects lower versions and derives current view paths", () => {
  for (const schemaVersion of [2, 3, 4, 5, 6, 7, 8, 9])
    assert.throws(
      () => parseHistoricalManifest({ schemaVersion }),
      (error: unknown) =>
        (error as { code?: string }).code === "baseline-incompatible-earlier",
    );
  const current = parseHistoricalManifest(identityManifest());
  const [entry] = current.entries;
  assert.ok(entry?.kind === "screen");
  assert.deepEqual(
    generatedViews(entry).map(({ path }) => path),
    [
      viewRoute("home", "mobile", "light"),
      viewRoute("home", "desktop", "light"),
    ],
  );
});

test("review v7 is the only accepted comparison result", () => {
  const result = {
    affectedConsumers: [],
    baseCommit: "a".repeat(40),
    baseRef: "origin/main",
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 7 as const,
    screens: [],
  };
  assert.deepEqual(parseReviewResult(result), result);
  assert.throws(
    () => parseReviewResult({ ...result, schemaVersion: 5 }),
    /unsupported schemaVersion/,
  );
});

test("removed page preview schema 3 carries only page identity", () => {
  const preview = {
    schemaVersion: 3,
    baseRef: "origin/main",
    baseCommit: "b".repeat(40),
    path: "guide",
  };
  assert.deepEqual(parseRemovedPagePreview(preview), preview);
  assert.throws(
    () => parseRemovedPagePreview({ ...preview, schemaVersion: 2 }),
    /^Error: \[mokly\/review\] unsupported preview version$/,
  );
});
