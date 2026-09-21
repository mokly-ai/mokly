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
  declaredDependencies: [],
  dependencies: [],
  description: "Removed page",
  id: "removed-page",
  kind: "page",
  navPath: [],
  relatedDocs: [],
  route: "archive/removed.html",
  sourcePath: "entries/removed.mockup.tsx",
  tags: [],
  title: "Removed page",
};
const result: ReviewResult = {
  baseCommit: "a".repeat(40),
  baseRef: "main",
  changedPaths: [],
  ignoredImpact: [],
  schemaVersion: 2,
  screens: [],
  sharedImpact: [],
};

test("publication preview boundaries report typed MoklyError failures", () => {
  for (const operation of [
    () =>
      staticRemovedPreviews(
        [{ entry: page, ancestors: [] }],
        { result },
        new Map(),
        `__mokly/diffs/__generations/${"b".repeat(64)}`,
      ),
    () =>
      advertisePublicationPreview(
        "view/archive/removed.html",
        "<!doctype html><html><body>missing stage</body></html>",
        page,
        {
          kind: "page",
          path: `__mokly/diffs/__generations/${"b".repeat(64)}/pages/archive/removed.html.json`,
        },
      ),
    () => publicationComparisonMetadata("/mutable/review.json"),
  ])
    assert.throws(operation, (error) => {
      assert.ok(error instanceof MoklyError);
      assert.equal(error.code, "export-invalid");
      return true;
    });
});
