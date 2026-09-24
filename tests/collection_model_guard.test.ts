import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const roots = [
  "src",
  "packages/viewer/src",
  "scripts",
  "examples/basic/entries",
  "examples/basic/src",
];
const historicalBoundary = new Set([
  "src/registry/historical_collections.ts",
  "src/registry/manifest_entries.ts",
  "src/registry/manifest_validation.ts",
]);
const obsoleteRecoveryBoundary = "packages/viewer/src/standalone/recovery.ts";
const obsoleteRecoveryFields = /\b(?:closedFolderKeys|closedCollectionIds)\b/u;
const obsoleteRecoveryFieldOccurrences = new RegExp(
  obsoleteRecoveryFields,
  "gu",
);
const collectionModel =
  /["'`]collection(?:["'`]|:)|\bimport\s*\{[^}]*\bcollection\b[^}]*\}\s*from\s*["']@mokly\/mokly["']|\bcollection\s*\(|\b(?:childIds|defineCollection|ManifestCollection|CatalogueCollection|NestedCollection\w*|RootCollection\w*|closedCollectionIds|filterBaselineClosedCollectionIds|ancestorCollections|readCollection|collectionKey|collectionDisclosureKey)\b|data-nav-collection|links to collection id/u;

test("collection-model matcher distinguishes removed constructs from ordinary words", () => {
  for (const snippet of [
    'entry.kind === "collection"',
    "`collection:${section}:${id}`",
    'import { collection, screen } from "@mokly/mokly";',
    "collection({ title: 'Old' })",
    "closedCollectionIds",
    "filterBaselineClosedCollectionIds",
    "ancestorCollections",
    "readCollection",
    "collectionKey",
    "collectionDisclosureKey",
    "childIds",
    "defineCollection",
    "ManifestCollection",
    "CatalogueCollection",
    "NestedCollectionNode",
    "RootCollectionNode",
    "data-nav-collection",
    "throw invalid(route, `links to collection id: ${id}`)",
  ])
    assert.match(snippet, collectionModel, snippet);
  for (const snippet of [
    "// React Native Web style collection",
    "garbage collection",
    '"folder:pages:A"',
    '"collections-and-tags"',
  ])
    assert.doesNotMatch(snippet, collectionModel, snippet);
});

test("collection-model constructs stay within historical manifest validation", () => {
  const matches: string[] = [];
  for (const root of roots)
    for (const name of readdirSync(root, { recursive: true })) {
      if (
        typeof name !== "string" ||
        !/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/u.test(name) ||
        /(?:^|\/)(?:dist|generated|node_modules)(?:\/|$)/u.test(name)
      )
        continue;
      const file = path.join(root, name);
      const text = readFileSync(file, "utf8");
      const currentText =
        file === obsoleteRecoveryBoundary
          ? text.replace(obsoleteRecoveryFieldOccurrences, "")
          : text;
      if (!collectionModel.test(currentText)) continue;
      if (!historicalBoundary.has(file)) matches.push(file);
    }
  assert.deepEqual(
    matches,
    [],
    "Only src/registry/{historical_collections,manifest_entries,manifest_validation}.ts may recognize collection records: they validate then discard historical v3–v5 entries, never create a current collection model.",
  );
  for (const file of historicalBoundary)
    assert.match(
      readFileSync(file, "utf8"),
      collectionModel,
      `${file}: remove stale allowlist entries when the historical boundary changes`,
    );
  assert.match(
    readFileSync(obsoleteRecoveryBoundary, "utf8"),
    obsoleteRecoveryFields,
    "Recovery must reject pre-v3 snapshot fields; remove this exception if those fields disappear.",
  );
});
