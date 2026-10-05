import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestPage, ReviewResult } from "@mokly/viewer/data";

import { MoklyError } from "../dist/errors.js";
import {
  publicationComparisonMetadata,
  staticRemovedPreviews,
} from "../dist/publication/removed_previews.js";
import { advertisePublicationPreview } from "../dist/publication/shell_previews.js";

const page: ManifestPage = {
  description: "Removed page",
  path: "removed-page",
  kind: "page",

  relatedDocs: [],
  sourcePath: "entries/removed.mockup.tsx",
  tags: [],
  title: "Removed page",
};
const result: ReviewResult = {
  baseCommit: "a".repeat(40),
  baseRef: "main",
  changedPaths: [],
  ignoredImpact: [],
  schemaVersion: 5 as const,
  screens: [],
  components: [],
  changes: [],
  affectedConsumers: [],
};

test("publication preview boundaries report typed MoklyError failures", () => {
  for (const operation of [
    () =>
      staticRemovedPreviews(
        [{ folderTitles: [], entry: page }],
        { result },
        new Map(),
      ),
    () =>
      advertisePublicationPreview(
        "view/archive/removed.html",
        "<!doctype html><html><body>missing stage</body></html>",
        page,
        { kind: "page" },
      ),
    () => publicationComparisonMetadata("/mutable/review.json"),
  ])
    assert.throws(operation, (error) => {
      assert.ok(error instanceof MoklyError);
      assert.equal(error.code, "export-invalid");
      return true;
    });
});

for (const kind of ["page", "screen"] as const)
  test(`publication accepts a removed ${kind} descriptor addressed by its nested path`, () => {
    const entry =
      kind === "page"
        ? { ...page, path: "account/old-page" }
        : {
            ...page,
            kind,
            path: "account/old-screen",
            colorSchemes: ["light"] as const,
            useCasePaths: [],
          };
    const descriptor = JSON.stringify({ kind, path: entry.path }).replaceAll(
      '"',
      "&quot;",
    );
    const html = `<html><body><div data-mokly-preview="${descriptor}"></div></body></html>`;
    const result = advertisePublicationPreview(
      `view/${entry.path}/index.html`,
      html,
      entry,
      { kind },
    );
    assert.match(result, /&quot;published&quot;/);
    assert.match(result, new RegExp(entry.path));
  });
