import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestDocument } from "@mokly/viewer/data";

import {
  documentResourceIndex,
  linkedDocumentResources,
} from "../src/documents/resource_references.js";
import { normalizeReviewPair } from "../src/review/ignore.js";

const entry: ManifestDocument = {
  kind: "document",
  path: "guide",
  title: "Guide",
  description: "",
  sourcePath: "specs/guide.md",
  relatedDocs: [],
  resources: ["specs/attachment.pdf"],
  colorSchemes: ["light", "dark"],
};

test("document attachments include only declared local links", () => {
  const index = documentResourceIndex([entry]);
  const html =
    '<a href="../attachment.pdf?download=1">PDF</a><a href="https://example.com/attachment.pdf">External</a><a href="mailto:hello@example.com">Mail</a><a href="../secret.ts">Source</a><a href="#heading">Section</a>';
  assert.deepEqual(linkedDocumentResources("guide/index.html", html, index), [
    "attachment.pdf",
  ]);
  assert.deepEqual(
    linkedDocumentResources("guide/index.dark.html", html, index),
    ["attachment.pdf"],
  );
  assert.deepEqual(
    linkedDocumentResources("other/index.html", html, index),
    [],
  );
});

test("paired ignored regions do not retain hidden attachment changes", () => {
  const html =
    '<html><body><!--mokly-review-ignore:start:footer--><a href="../attachment.pdf">PDF</a><!--mokly-review-ignore:end:footer--><h1>Guide</h1></body></html>';
  const pair = normalizeReviewPair(html, html, "guide/index.html");
  const index = documentResourceIndex([entry]);
  assert.deepEqual(
    linkedDocumentResources("guide/index.html", pair.head, index),
    [],
  );
  assert.deepEqual(linkedDocumentResources("guide/index.html", html, index), [
    "attachment.pdf",
  ]);
});
