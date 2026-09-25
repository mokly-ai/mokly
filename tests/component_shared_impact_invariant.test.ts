import assert from "node:assert/strict";
import { test } from "node:test";

import { minimatch } from "minimatch";

import type { Manifest } from "../packages/viewer/dist/registry/types.js";

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

  const pairs = manifestPairs(before.manifest, after.manifest);
  for (const [kind, actual] of [
    ["screen", result.screens.map((entry) => entry.sharedImpact)],
    ["component", result.components.map((entry) => entry.sharedImpact)],
  ] as const) {
    const expectedPairs = pairs.filter(
      (pair) => (pair.after ?? pair.before)!.kind === kind,
    );
    assert.equal(actual.length, expectedPairs.length);
    expectedPairs.forEach((pair, index) =>
      assert.deepEqual(
        actual[index],
        documentedEntryImpact(before.manifest, after.manifest, pair),
        pairKey((pair.after ?? pair.before)!),
      ),
    );
  }
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

type RoutedEntry = Exclude<Manifest["entries"][number], { kind: "page" }>;
type EntryPair = {
  before: RoutedEntry | undefined;
  after: RoutedEntry | undefined;
};

function routedEntries(manifest: Manifest): RoutedEntry[] {
  return manifest.entries.filter(
    (entry): entry is RoutedEntry => entry.kind !== "page",
  );
}

function pairKey(entry: RoutedEntry): string {
  return `${entry.kind}:${entry.kind === "component" ? entry.id : entry.route}`;
}

function manifestPairs(before: Manifest, after: Manifest): EntryPair[] {
  const bases = new Map(
    routedEntries(before).map((entry) => [pairKey(entry), entry]),
  );
  const heads = new Map(
    routedEntries(after).map((entry) => [pairKey(entry), entry]),
  );
  return [...new Set([...bases.keys(), ...heads.keys()])]
    .sort()
    .map((key) => ({ before: bases.get(key), after: heads.get(key) }));
}

/** Independent oracle for the pre-change set, using only fixture inputs. */
function documentedEntryImpact(
  before: Manifest,
  after: Manifest,
  pair: EntryPair,
): string[] {
  return changedPaths
    .filter((changed) => {
      const owners = new Set(
        [before, after].flatMap((manifest) =>
          manifest.entries.flatMap((entry) =>
            entry.kind === "component" &&
            entry.ownedDependencies.some((root) => contains(root, changed))
              ? [entry.id]
              : [],
          ),
        ),
      );
      const matchedGlob = globs.some((glob) =>
        minimatch(changed, glob, { dot: true }),
      );
      const stylesheet = /\.css$/i.test(changed);
      if (matchedGlob && !stylesheet) return true;
      // The fixture's public stylesheet analysis root is mockups/.
      if (stylesheet && changed.startsWith("mockups/")) return false;
      return [pair.before, pair.after].some(
        (entry) => entry && oldIndependent(entry, changed, owners, matchedGlob),
      );
    })
    .sort();
}

function oldIndependent(
  entry: RoutedEntry,
  changed: string,
  owners: ReadonlySet<string>,
  matchedGlob: boolean,
): boolean {
  if (entry.kind === "component" && owners.has(entry.id)) return true;
  const declared = entry.declaredDependencies ?? [];
  if (entry.kind === "screen" && declared.includes(changed)) return true;
  return (
    owners.size === 0 &&
    (matchedGlob || declared.some((root) => contains(root, changed)))
  );
}

function contains(root: string, changed: string): boolean {
  return changed === root || changed.startsWith(`${root}/`);
}
