import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestEntry } from "@mokly/viewer/data";

import { normalizeReviewPair } from "../packages/mokly/src/review/ignore.js";
import { catalogueLinkNormalizer } from "../packages/mokly/src/review/moves/links.js";

function page(path: string): ManifestEntry {
  return {
    kind: "page",
    path,
    title: path,
    description: "Page",
    sourcePath: `specs/${path}.ts`,
    declaredDependencies: [],
    relatedDocs: [],
  };
}

test("move normalization maps catalogue links and resolves resource routes while preserving prose", () => {
  const links = catalogueLinkNormalizer(
    [page("old/target")],
    [page("new/target")],
    [{ kind: "page", path: "new/target", previousPath: "old/target" }],
  )("old/linker/index.html", "new/linker/index.html");
  const before =
    '<h1>old/target</h1><a href="../target/index.html#part" data-mokly-link="old/target#part">Target</a><button data-nav-href="../target/index.html#part">Go</button><img src="logo.png"><a href="https://example.com/old/target">Site</a>';
  const after = before.replaceAll(
    'data-mokly-link="old/target',
    'data-mokly-link="new/target',
  );
  const normalized = normalizeReviewPair(before, after, "linker", links);
  assert.notEqual(normalized.base, normalized.head);
  assert.equal(normalized.resourceBase, before);
  assert.equal(normalized.resourceHead, after);
  assert.ok(normalized.head.includes('href="mock:new/target#part"'));
  assert.ok(normalized.head.includes('data-nav-href="mock:new/target#part"'));
  assert.ok(normalized.head.includes("<h1>old/target</h1>"));
  assert.ok(normalized.head.includes('<img src="new/linker/logo.png">'));
  assert.ok(normalized.head.includes('href="https://example.com/old/target"'));
});

test("material normalization uses accepted earlier pairs and never invents a move", () => {
  const before = '<a href="../old/index.html" data-mokly-link="old">Target</a>';
  const after = '<a href="../new/index.html" data-mokly-link="new">Target</a>';
  const links = catalogueLinkNormalizer(
    [page("old")],
    [page("new")],
    [],
  )("linker/index.html", "linker/index.html");
  const normalized = normalizeReviewPair(before, after, "linker", links);
  assert.notEqual(normalized.base, normalized.head);
});

test("ignore boundaries still hide only paired content and keep material keys", () => {
  const links = catalogueLinkNormalizer(
    [page("old")],
    [page("new")],
    [{ kind: "page", path: "new", previousPath: "old" }],
  )("linker/index.html", "linker/index.html");
  const before =
    '<!--mokly-review-ignore:start:footer--><a href="../old/index.html">Old text</a><!--mokly-review-ignore:end:footer-->';
  const after =
    '<!--mokly-review-ignore:start:footer--><a href="../new/index.html">New text</a><!--mokly-review-ignore:end:footer-->';
  const pair = normalizeReviewPair(before, after, "linker", links);
  assert.equal(pair.base, pair.head);
  assert.deepEqual(pair.ignoredIds, ["footer"]);
  const oneSided = normalizeReviewPair(
    before,
    '<a href="../new/index.html">New text</a>',
    "linker",
    links,
  );
  assert.notEqual(oneSided.base, oneSided.head);
});

test("normalization distinguishes a reused current path from its moved former kind", () => {
  const current = {
    ...page("old"),
    kind: "document" as const,
    colorSchemes: ["light"] as const,
    resources: [],
  };
  const links = catalogueLinkNormalizer(
    [page("old")],
    [current, page("new")],
    [{ kind: "page", path: "new", previousPath: "old" }],
  )("linker/index.html", "linker/index.html");
  const before = '<a href="../old/index.html" data-mokly-link="old">Target</a>';
  assert.notEqual(
    normalizeReviewPair(before, before, "linker", links).base,
    normalizeReviewPair(before, before, "linker", links).head,
  );
});

test("resource URLs use resolved routes across depth, including CSS and srcset duplicates", () => {
  const links = catalogueLinkNormalizer(
    [],
    [],
    [],
  )("old/view/index.html", "new/deep/view/index.html");
  const before =
    '<link href="../../theme.css"><img srcset="../../logo.svg 1x, ../../logo.svg 2x"><div style="background: url(../../logo.svg)"></div><style>@import "../../theme.css";</style>';
  const after = before.replaceAll("../../", "../../../");
  const pair = normalizeReviewPair(before, after, "test", links);
  assert.equal(pair.base, pair.head);
  assert.ok(pair.head.includes('srcset="logo.svg 1x, logo.svg 2x"'));
  assert.equal(pair.resourceBase, before);
  assert.equal(pair.resourceHead, after);
});

test("repeated srcset destinations normalize each original token exactly once", () => {
  const links = catalogueLinkNormalizer(
    [],
    [],
    [],
  )("folder/index.html", "folder/index.html");
  assert.equal(
    links.before('<img srcset="logo.svg 1x, logo.svg 2x">'),
    '<img srcset="folder/logo.svg 1x, folder/logo.svg 2x">',
  );
});
