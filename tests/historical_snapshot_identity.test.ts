import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { resolveCatalogueEntry } from "../packages/viewer/src/catalogue/entry_selection.js";
import { readCurrentPath } from "../packages/viewer/src/catalogue/path_values.js";
import { readCatalogue } from "../packages/viewer/src/catalogue/reader.js";
import type { CatalogueReadModel } from "../packages/viewer/src/catalogue/types.js";
import type {
  ManifestScreen,
  ManifestV8,
} from "../packages/viewer/src/registry/types.js";
import type { ReviewResultV5 } from "../packages/viewer/src/review/component_types.js";
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
const oldScreen = screen("removed-screen", "Old screen", "old/index.html");
const currentScreen = screen(
  "current-screen",
  "Current screen",
  "current-screen/index.html",
);
const baseline = manifest([oldScreen]);
const current = {
  ...manifest([currentScreen]),
  schemaVersion: 8 as const,
  folders: [],
};

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
  assert.equal(
    resolveCatalogueEntry(identityLess, {
      path: oldScreen.path,
      kind: oldScreen.kind,
    })?.entry.path,
    oldScreen.path,
  );
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
      id: "another-old",
    },
  });
  assert.throws(() => readCatalogue(duplicated), /duplicate/i);
});

test("reader rejects current and removed records sharing an id", () => {
  const fixture = readCatalogue(
    JSON.parse(requireFixture("../docs/protocol/fixtures/catalogue-v4.json")),
  );
  const current = fixture.screens[0]!;
  const removed = {
    entry: {
      ...structuredClone(current),
      title: `Historical ${current.title}`,
    },
    snapshotId: "f".repeat(64),
  };
  assert.throws(
    () => readCatalogue({ ...fixture, removedEntries: [removed] }),
    /current|removed|same-id/i,
  );
});

test("historical workspace resolution owns the old identity and Removed status", () => {
  const model = project(BASELINE_A);
  const catalogue = viewerCatalogue(model);
  const historical = model.removedEntries[0]!;
  if (historical.entry.kind !== "screen")
    assert.fail("Expected a historical screen");
  const displayed = displayEntry(historical.entry);
  if (displayed.kind !== "screen") assert.fail("Expected a displayed screen");
  const workspace = publicWorkspace(catalogue, model, displayed);

  const selected = catalogue.byPath.get(readCurrentPath(currentScreen.path));
  assert.ok(selected);
  assert.equal(selected.path, currentScreen.path);
  assert.equal(workspace.entry.path, oldScreen.path);
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
    changedEntries: removedEntries.map(({ entry }) => entry.path),
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

function review(baseCommit: string): ReviewResultV5 {
  return {
    affectedConsumers: [],
    baseCommit,
    baseRef: "origin/main",
    changedPaths: [],
    changes: [],
    components: [],
    ignoredImpact: [],
    schemaVersion: 5 as const,
    screens: [],
    sharedImpact: [],
  };
}

function manifest(entries: readonly CurrentManifestScreen[]): ManifestV8 {
  return {
    entries,
    generatedBy: "mokly",
    schemaVersion: 8 as const,
    folders: [],
    sourceFiles: [
      ...new Set(entries.map(({ sourcePath }) => sourcePath)),
    ].sort(),
  };
}

function screen(
  id: string,
  title: string,
  _route: string,
): CurrentManifestScreen {
  return {
    colorSchemes: ["light"],
    declaredDependencies: [],
    description: `${title} description`,
    path: id,
    kind: "screen",

    relatedDocs: [],
    sourcePath: `entries/${id}.mockup.tsx`,
    title,
    useCasePaths: [],
  };
}

function requireFixture(relative: string): string {
  return fs.readFileSync(new URL(relative, import.meta.url), "utf8");
}
