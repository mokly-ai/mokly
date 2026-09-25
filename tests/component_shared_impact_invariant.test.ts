import assert from "node:assert/strict";
import { test } from "node:test";

import { minimatch } from "minimatch";

import type { Manifest } from "../packages/viewer/dist/registry/types.js";
import type { ReviewResultV3 } from "../packages/viewer/dist/review/component_types.js";

import {
  pathCatalogueSource,
  pathEvidenceFixture,
  withEntryPaths,
} from "./helpers/component_path_evidence_fixture.js";

const globs = ["src/components/**", "src/styles/**", "mockups/**"];
const changedPaths = [
  "src/components/unowned.mokly.tsx",
  "src/shared/before/child.ts",
  "src/shared/after/child.ts",
  "notes.md",
  "src/components/action/impl.ts",
  "src/styles/owned.css",
  "src/styles/free.css",
  "mockups/unused.css",
  "src/tokens/pane.ts",
  "src/tokens/home.ts",
];

test("entry sharedImpact matches the documented old set across globs, declarations, ownership and CSS scope", async (t) => {
  const { before, after, result } = await pathEvidenceFixture(t, {
    beforeSource: mixedSource("src/shared/before"),
    afterSource: mixedSource("src/shared/after"),
    changedPaths,
    sharedGlobs: globs,
  });

  const journey = result.changes.find(
    (entry) => (entry.after ?? entry.before)?.id === "journey",
  );
  assert.deepEqual(
    journey?.reasons.flatMap((reason) =>
      reason.kind === "dependency" ? [reason.path] : [],
    ) ?? [],
    [],
  );
  for (const [kind, entries] of [
    ["screen", result.screens],
    ["component", result.components],
  ] as const)
    for (const entry of entries)
      assert.deepEqual(
        entry.sharedImpact,
        documentedEntryImpact(
          before.manifest,
          after.manifest,
          result,
          kind,
          entry.id,
        ),
        entry.route,
      );
});

function mixedSource(directory: string): string {
  let source = pathCatalogueSource([directory]);
  const actionOwners = [
    "notes.md",
    "src/components/action",
    "src/styles/owned.css",
  ];
  source = withEntryPaths(
    source,
    "action",
    [directory, ...actionOwners],
    actionOwners,
  );
  source = withEntryPaths(source, "pane", [directory, "src/tokens/pane.ts"]);
  return withEntryPaths(source, "home", [
    directory,
    "notes.md",
    "src/tokens/home.ts",
  ]);
}

/** Independent oracle for the pre-change set, written from the v3 contract. */
function documentedEntryImpact(
  before: Manifest,
  after: Manifest,
  result: ReviewResultV3,
  kind: "screen" | "component",
  id: string,
): string[] {
  const records = [before, after].flatMap((manifest) =>
    manifest.entries.filter((entry) => entry.kind === kind && entry.id === id),
  );
  const globalMatches = changedPaths.filter((changed) =>
    globs.some((glob) => minimatch(changed, glob, { dot: true })),
  );
  const unownedMatches = changedPaths.filter(
    (changed) =>
      ![before, after].some((manifest) =>
        manifest.entries.some(
          (entry) =>
            entry.kind === "component" &&
            entry.ownedDependencies.some((root) => contains(root, changed)),
        ),
      ) &&
      (globalMatches.includes(changed) ||
        records.some((entry) =>
          entry.declaredDependencies?.some((root) => contains(root, changed)),
        )) &&
      !(/^mockups\//.test(changed) && /\.css$/i.test(changed)),
  );
  const reasons = result.changes
    .find(
      (entry) =>
        entry.kind === kind && (entry.after ?? entry.before)?.id === id,
    )
    ?.reasons.flatMap((reason) =>
      reason.kind === "dependency" ? [reason.path] : [],
    );
  return [
    ...new Set([
      ...globalMatches.filter((changed) => !/\.css$/i.test(changed)),
      ...unownedMatches,
      ...(reasons ?? []),
    ]),
  ].sort();
}

function contains(root: string, changed: string): boolean {
  return changed === root || changed.startsWith(`${root}/`);
}
