import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  resolveCatalogueRoute,
  resolveCatalogueSelection,
} from "../packages/viewer/src/catalogue/entry_selection.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import type { CatalogueReadModel } from "../packages/viewer/src/catalogue/types.js";
import type {
  ManifestScreen,
  ManifestV5,
} from "../packages/viewer/src/registry/types.js";
import type { ReviewResultV3 } from "../packages/viewer/src/review/component_types.js";
import { createCatalogue } from "../packages/viewer/src/shell/catalogue.js";
import {
  displayEntry,
  viewerCatalogue,
} from "../packages/viewer/src/viewer/projection.js";
import { publicWorkspace } from "../packages/viewer/src/viewer/public_workspace.js";
import { projectCatalogue } from "../src/catalogue/projection.js";
import { serializeCatalogue } from "../src/catalogue/serialization.js";
import { removedManifestEntries } from "../src/registry/changes.js";

type CurrentManifestScreen = ManifestScreen & {
  declaredDependencies: readonly string[];
};

const BASELINE_A = "a".repeat(40);
const BASELINE_B = "b".repeat(40);
const GENERATION = "c".repeat(64);
const oldScreen = screen("shared-screen", "Old screen", "screens/old.html");
const currentScreen = screen(
  "shared-screen",
  "Current screen",
  "screens/current.html",
);
const baseline = manifest([oldScreen]);
const current = manifest([currentScreen]);

test("projection publishes stable per-record identity before comparison generation", () => {
  const live = project(BASELINE_A);
  const pinned = project(
    BASELINE_A,
    `__mokly/diffs/__generations/${GENERATION}/review.json`,
    { content: 1, evidence: 9 },
  );
  const replaced = project(BASELINE_B);
  const otherCatalogue = project(
    BASELINE_A,
    null,
    { content: 1, evidence: 1 },
    "other/mokly.config.ts",
  );
  const snapshotId = snapshot(live);

  assert.match(snapshotId, /^[a-f0-9]{64}$/);
  assert.equal(snapshot(pinned), snapshotId);
  assert.notEqual(snapshot(replaced), snapshotId);
  assert.notEqual(snapshot(otherCatalogue), snapshotId);
  assert.equal(
    readCatalogue(JSON.parse(serializeCatalogue(live))).removedEntries[0]
      ?.snapshotId,
    snapshotId,
  );
});

test("projection rejects conflicting accepted baseline identities", () => {
  assert.throws(
    () =>
      projectCatalogue({
        ...projectionInput(BASELINE_A),
        comparison: review(BASELINE_B),
      }),
    /snapshot|baseline|identity/i,
  );
});

test("reader safely derives older generation-backed identities", () => {
  const legacy = projectCatalogue({
    ...projectionInput(undefined),
    comparisonUrl: `__mokly/diffs/__generations/${GENERATION}/review.json`,
  });
  const value = JSON.parse(serializeCatalogue(legacy));
  delete value.removedEntries[0].snapshotId;

  const first = readCatalogue(value);
  const second = readCatalogue(structuredClone(value));
  assert.match(snapshot(first), /^[a-f0-9]{64}$/);
  assert.equal(snapshot(second), snapshot(first));

  value.comparisonUrl = null;
  const identityLess = readCatalogue(value);
  assert.equal(identityLess.removedEntries[0]?.snapshotId, undefined);
  assert.equal(resolveCatalogueRoute(identityLess, oldScreen.route), undefined);
});

test("reader rejects malformed and duplicate published identities", () => {
  const value = JSON.parse(serializeCatalogue(project(BASELINE_A)));
  value.removedEntries[0].snapshotId = "not-a-snapshot";
  assert.throws(() => readCatalogue(value), /invalid|hash/i);

  const duplicated = JSON.parse(serializeCatalogue(project(BASELINE_A)));
  duplicated.removedEntries.push({
    ...structuredClone(duplicated.removedEntries[0]),
    entry: {
      ...structuredClone(duplicated.removedEntries[0].entry),
      route: "screens/another-old.html",
    },
  });
  assert.throws(() => readCatalogue(duplicated), /duplicate/i);
});

test("exact selection resolves every routed kind independently of stable id", () => {
  const fixture = readCatalogue(
    JSON.parse(requireFixture("../docs/protocol/fixtures/catalogue-v1.json")),
  );
  const current = [
    fixture.screens[0]!,
    fixture.pages[0]!,
    fixture.useCases[0]!,
    fixture.components[0]!,
  ];
  const removedEntries = current.map((entry, index) => ({
    ancestors: [],
    entry: {
      ...structuredClone(entry),
      route: `history/${entry.kind}-${index}.html`,
    },
    snapshotId: String(index + 1).repeat(64),
  }));
  const model = { ...fixture, removedEntries };

  for (const record of removedEntries) {
    assert.equal(
      resolveCatalogueSelection(model, record.entry.id)?.entry.route,
      current.find(({ id }) => id === record.entry.id)?.route,
    );
    assert.equal(
      resolveCatalogueSelection(model, record.entry.id, record.snapshotId)
        ?.entry.route,
      record.entry.route,
    );
  }
});

test("historical workspace resolution owns the old route and Removed status", () => {
  const model = project(BASELINE_A);
  const catalogue = viewerCatalogue(model);
  const historical = model.removedEntries[0]!;
  if (historical.entry.kind !== "screen")
    assert.fail("Expected a historical screen");
  const displayed = displayEntry(historical.entry);
  if (displayed.kind !== "screen") assert.fail("Expected a displayed screen");
  const workspace = publicWorkspace(model, displayed);

  const selected = catalogue.byId.get(currentScreen.id);
  assert.ok(selected && selected.kind !== "collection");
  assert.equal(selected.route, currentScreen.route);
  assert.equal(workspace.entry.route, oldScreen.route);
  assert.equal(workspace.entry.title, oldScreen.title);
  assert.equal(workspace.removed, true);
  assert.equal(workspace.status, "Removed");
  assert.equal(workspace.comparisonEligible, false);
});

function project(
  commit: string,
  comparisonUrl: string | null = null,
  revision: CatalogueReadModel["revision"] = { content: 1, evidence: 1 },
  configPath = "mokly.config.ts",
): CatalogueReadModel {
  return projectCatalogue({
    ...projectionInput(commit),
    comparisonUrl,
    configPath,
    revision,
  });
}

function projectionInput(commit: string | undefined) {
  const removedEntries = removedManifestEntries(current, baseline);
  return {
    catalogue: createCatalogue(current, removedEntries),
    changesStatus: "ready" as const,
    changedRoutes: removedEntries.map(({ entry }) => entry.route),
    configPath: "mokly.config.ts",
    comparisonUrl: null,
    ...(commit
      ? {
          evidence: {
            baseline,
            comparison: {
              baseCommit: commit,
              baseRef: "origin/main",
              changedPaths: [],
              headDigests: {},
            },
          },
        }
      : {}),
    revision: { content: 1, evidence: 1 },
  };
}

function snapshot(model: CatalogueReadModel): string {
  return model.removedEntries[0]?.snapshotId ?? "";
}

function review(baseCommit: string): ReviewResultV3 {
  return {
    affectedConsumers: [],
    baseCommit,
    baseRef: "origin/main",
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 3,
    screens: [],
    sharedImpact: [],
  };
}

function manifest(entries: readonly CurrentManifestScreen[]): ManifestV5 {
  return {
    entries,
    generatedBy: "mokly",
    schemaVersion: 5,
    sourceFiles: [
      ...new Set(entries.map(({ sourcePath }) => sourcePath)),
    ].sort(),
  };
}

function screen(
  id: string,
  title: string,
  route: string,
): CurrentManifestScreen {
  const stem = route.slice(0, -5);
  return {
    declaredDependencies: [],
    dependencies: [],
    description: `${title} description`,
    fragments: {
      desktop: `${stem}.desktop.html`,
      mobile: `${stem}.mobile.html`,
    },
    id,
    kind: "screen",
    navPath: [],
    relatedDocs: [],
    route,
    sourcePath: `entries/${id}.mockup.tsx`,
    title,
    useCaseIds: [],
    viewports: ["mobile", "desktop"],
  };
}

function requireFixture(relative: string): string {
  return fs.readFileSync(new URL(relative, import.meta.url), "utf8");
}
