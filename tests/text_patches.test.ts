import assert from "node:assert/strict";
import test from "node:test";

import { rebaseStyleOwnership } from "../dist/components/style_ownership.js";
import { insertComponentStylesheets } from "../dist/components/stylesheet_links.js";
import { rewriteReviewSentinels } from "../dist/renderer/sentinels.js";
import { TextOffsetMap } from "../dist/text_patches.js";

const css = 'p::before{content:"😀é"}';
const source = `<html><head></head><body>😀<style>${css}</style><style>${css}</style></body></html>`;
const start = source.indexOf(css);
const owned = {
  startOffset: start,
  endOffset: start + css.length,
  componentIds: ["action"],
};

test("one offset map composes UTF-16 insertions and replacements without matching repeated style text", () => {
  const map = new TextOffsetMap(source);
  const head = source.indexOf("</head>");
  map.apply([{ start: head, end: head, text: `<style>${css}</style>` }]);
  const emoji = map.html.indexOf("😀<style>");
  map.apply([
    {
      start: emoji,
      end: emoji + 2,
      text: '<a href="../long/path.html">😀</a>',
    },
  ]);
  map.apply([{ start: 0, end: 0, text: "\n" }]);
  const [result] = rebaseStyleOwnership(map, [owned]);
  assert.equal(
    result!.startOffset,
    map.html.indexOf("<body>") +
      map.html.slice(map.html.indexOf("<body>")).indexOf(css),
  );
  assert.equal(map.html.slice(result!.startOffset, result!.endOffset), css);
  assert.equal(
    map.html,
    "\n" +
      source
        .replace("</head>", `<style>${css}</style></head>`)
        .replace("😀<style>", '<a href="../long/path.html">😀</a><style>'),
  );
});

test("range boundaries exclude adjacent insertions and reject interior edits", () => {
  const map = new TextOffsetMap("prefix😀ownedend");
  map.apply([
    { start: 8, end: 8, text: "LEFT" },
    { start: 13, end: 13, text: "RIGHT" },
  ]);
  assert.deepEqual(map.range(8, 13), { start: 12, end: 17 });
  assert.equal(map.html.slice(12, 17), "owned");
  const interior = new TextOffsetMap("prefixownedend");
  interior.apply([{ start: 8, end: 8, text: "changed" }]);
  assert.throws(
    () => interior.range(6, 11),
    /destroys a preserved source range/,
  );
});

test("overlapping and out-of-bounds patches reject without changing the source", () => {
  for (const patches of [
    [
      { start: 1, end: 4, text: "a" },
      { start: 3, end: 5, text: "b" },
    ],
    [{ start: -1, end: 0, text: "" }],
    [{ start: 0, end: 20, text: "" }],
    [{ start: 2.5, end: 3, text: "" }],
  ]) {
    const map = new TextOffsetMap("source");
    assert.throws(() => map.apply(patches), /Invalid or overlapping/);
    assert.equal(map.html, "source");
  }
});

test("style authentication rejects destroyed tags, edited CSS and forged ownership", () => {
  const removed = new TextOffsetMap(source);
  removed.apply([{ start: start - 7, end: start, text: "" }]);
  assert.throws(
    () => rebaseStyleOwnership(removed, [owned]),
    /preserved text inside a style/,
  );
  const rewritten = new TextOffsetMap(source);
  rewritten.apply([{ start, end: start + 1, text: "q" }]);
  assert.throws(
    () => rebaseStyleOwnership(rewritten, [owned]),
    /destroys a preserved/,
  );
  const identity = new TextOffsetMap(source);
  assert.throws(
    () =>
      rebaseStyleOwnership(identity, [
        { ...owned, startOffset: 0, endOffset: 2 },
      ]),
    /inside a style/,
  );
  assert.throws(
    () => rebaseStyleOwnership(identity, [owned, owned]),
    /overlapping or unordered/,
  );
});

test("review sentinel rewrites expose exact patches before owned CSS", () => {
  const sentinel =
    '<template data-mokly-review-ignore-start="stamp"></template>x<template data-mokly-review-ignore-end="stamp"></template>';
  const input = source.replace("<body>", "<body>" + sentinel);
  const result = rewriteReviewSentinels(input);
  const map = new TextOffsetMap(input);
  assert.equal(map.apply(result.patches), result.html);
  const offset = input.indexOf(css);
  const [style] = rebaseStyleOwnership(map, [
    { ...owned, startOffset: offset, endOffset: offset + css.length },
  ]);
  assert.equal(map.html.slice(style!.startOffset, style!.endOffset), css);
  assert.match(
    map.html,
    /<!--mokly-review-ignore:start:stamp-->x<!--mokly-review-ignore:end:stamp-->/,
  );
});

test("declared stylesheet insertion shares the preserved UTF-16 offset map", () => {
  const map = new TextOffsetMap(source);
  const html = insertComponentStylesheets(
    source,
    "mokly-generated/home/index.mobile.html",
    [],
    0,
    ["action.css"],
    undefined,
    "home/index.mobile.html",
    map,
  );
  assert.equal(
    html,
    source.replace(
      "</head>",
      '<link rel="stylesheet" href="../../action.css"></head>',
    ),
  );
  assert.equal(map.html, html);
  const [mapped] = rebaseStyleOwnership(map, [owned]);
  assert.equal(mapped!.startOffset, html.indexOf(css));
  assert.equal(html.slice(mapped!.startOffset, mapped!.endOffset), css);
});
