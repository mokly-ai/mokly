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
const collectionModel =
  /["']collection["']|["']collection:|\b(?:childIds|defineCollection|ManifestCollection|CatalogueCollection|NestedCollection\w*|RootCollection\w*)\b/u;

test("collection-model constructs stay within historical manifest validation", () => {
  const matches: string[] = [];
  for (const root of roots)
    for (const name of readdirSync(root, { recursive: true })) {
      if (typeof name !== "string" || !/\.(?:ts|tsx|js|mjs)$/u.test(name))
        continue;
      const file = path.join(root, name);
      const text = readFileSync(file, "utf8");
      if (!collectionModel.test(text)) continue;
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
});
