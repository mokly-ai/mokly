import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const sharedCalls = new Map<string, readonly string[]>([
  ["src/review/component_compare.ts", ["snapshotViewPath"]],
  ["src/review/artifact_resources.ts", ["snapshotViewPath"]],
  [
    "src/review/page_preview.ts",
    ["snapshotPagePath", "pagePreviewMetadataPath"],
  ],
  ["src/review/selected.ts", ["snapshotViewPath"]],
  ["src/publication/removed_previews.ts", ["pagePreviewMetadataPath"]],
  ["src/server/public_review.ts", ["snapshotViewPath"]],
  [
    "packages/viewer/src/previews/request.ts",
    ["pagePreviewMetadataPath", "snapshotPagePath", "snapshotViewPath"],
  ],
  ["packages/viewer/src/shell/comparison_selection.ts", ["snapshotViewPath"]],
  ["scripts/package/export.mjs", ["snapshotViewPath"]],
]);

test("snapshot and page-preview artifact names use the shared path builders", async () => {
  await assert.rejects(fs.access("src/review/paths.ts"), { code: "ENOENT" });
  for (const [file, helpers] of sharedCalls) {
    const source = await fs.readFile(file, "utf8");
    for (const helper of helpers)
      assert.match(source, new RegExp(`\\b${helper}\\(`), `${file}: ${helper}`);
    assert.doesNotMatch(source, /\bsnapshotPath\(/, file);
  }
});
