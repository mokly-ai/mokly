import assert from "node:assert/strict";
import test from "node:test";

import { htmlReferenceValues } from "../dist/html_reference_values.js";
import { extractHtmlReferences } from "../dist/html_references.js";
import { PageAnalysis } from "../dist/review/page_analysis.js";
import {
  originalPageReferences,
  pageReferenceRecords,
} from "../dist/review/page_reference_records.js";

import { cssReferenceInputs } from "./helpers/html_reference_inputs.js";
import { extractHtmlReferences as delivered } from "./helpers/page_m6/html_references.js";

const inputs = [
  '<a id="a&amp;b" href="screen.html#one" data-nav-href="other.html">a</a><img src="a&amp;b.svg" srcset="one.svg 1x, two.svg 2x, three.svg,">',
  '<audio src="a"></audio><embed src="b"><iframe src="c"></iframe><input src="d"><script src="e"></script><source src="f"><track src="g"><object data="h"></object><video poster="i" src="j"></video>',
  '<image href="one.svg" xlink:href="two.svg"></image><use href="three.svg" xlink:href="four.svg"></use><svg><image xlink:href="five.svg"/><use href="six.svg"/></svg>',
  '<link rel="preload" href="hint.css"><link rel="stylesheet preload" href="sheet.css"><link rel="modulepreload" href="module.js"><a style="background:url(&quot;bg.svg&quot;)"></a>',
  '<style>@import "theme.css"; a{background:u\\72l(one.svg);content:"url(fake.svg)"}</style>',
  '<template><img src="inert.svg"><template><img src="nested.svg"></template></template><img src="visible.svg">',
  '<select><img src="discarded.svg"><style>.a{background:url(style.svg)}</style></select><p><img src="visible.svg">',
  '\uFEFF\r\n😀<img src="astral.svg"><style>\r\na{background:url(a.svg)}</style>',
  "<style>.a{background:url(unfinished.svg)",
  "<svg><style>.a{background:url(foreign.svg)}<!--comment--> .b{background:url(second.svg)}</style></svg>",
  '<noscript><img src="inert.svg"></noscript><script>"<img src=not-a-reference>"</script><!--<img src="comment.svg">-->',
  '<html><body><p>first</p><body style="background:url(second.png)" srcset="one.png 1x, two.png 2x">',
  '<p>implied</p><body style="background:url(implied.png)">',
  '<html><body><p>first</p><html style="background:url(root.png)" data-nav-href="next.html">',
  '<b style="background:url(cloned.png)"><p>inside</b>outside</p>',
  'before<body style="background:url(merged.png)">after',
  '<p>text</p><script>"<body style=\'background:url(actual.png)\'>"</script><select><body style="background:url(actual.png)"></select><body style="background:url(actual.png)">',
  ...["body", "html"].flatMap((tag) => {
    const actual = `<${tag} style="background:url(token.svg)">`;
    return [
      `<p>a</p></div title='${actual}'>${actual}`,
      `<p>a</p><tr title='${actual}'>${actual}`,
      `<p>a</p><body title='${actual}'>${actual}`,
      `<!DOCTYPE html PUBLIC '${actual}'><p>a</p>${actual}`,
      ...["template", "select"].flatMap((container) => [
        `<p>a</p><svg><${container}><foreignObject>${actual}</foreignObject></${container}></svg>`,
        `<p>a</p><math><${container}><annotation-xml encoding="text/html">${actual}</annotation-xml></${container}></math>`,
        `<p>a</p><math><${container}><mi>${actual}</mi></${container}></math>`,
      ]),
    ];
  }),
  '<p>a</p><select><html style="background:url(select-root.svg)"><body style="background:url(discarded.svg)"></select>',
  ...cssReferenceInputs.map(([source]) => `<style>${source}</style>`),
];

for (const resourceHints of [false, true])
  for (const [index, source] of inputs.entries())
    test(`source inventory equals the delivered extractor ${index}, hints=${resourceHints}`, () => {
      const document = new PageAnalysis(source, "inventory.html").document;
      const options = { resourceHints };
      const expected = delivered(source, options);
      assert.deepEqual(
        extractHtmlReferences(source, options, document),
        expected,
      );
      assert.deepEqual(
        originalPageReferences(pageReferenceRecords(source, document, options)),
        expected,
      );
    });

test("records retain decoded values, complete UTF-16 spans, spelling and inert ancestors", () => {
  const source =
    '\uFEFF😀\r\n<template><img src="a&amp;b.svg" srcset="one.svg 1x, two.svg 2x"></template><style>a{background:url(c.svg)}</style>';
  const analysis = new PageAnalysis(source, "page.html");
  const image = analysis.references.find(({ kind }) => kind === "source")!;
  assert.equal(image.value, "a&b.svg");
  assert.equal(image.start, source.indexOf('src="'));
  assert.equal(source.slice(image.start, image.end), 'src="a&amp;b.svg"');
  assert.equal(image.spelling, source.slice(image.start, image.end));
  assert.equal(image.inertAncestors.length, 1);
  const candidates = analysis.references.filter(
    ({ kind }) => kind === "srcset",
  );
  assert.deepEqual(
    candidates.map(({ value }) => value),
    ["one.svg", "two.svg"],
  );
  assert.equal(candidates[0]!.start, candidates[1]!.start);
  assert.equal(candidates[0]!.end, candidates[1]!.end);
  const style = analysis.references.find(({ kind }) => kind === "styleText")!;
  assert.equal(
    source.slice(style.start, style.end),
    "a{background:url(c.svg)}",
  );
  assert.deepEqual(
    htmlReferenceValues(
      { tagName: "use", attrs: [{ name: "xlink:href", value: "any.svg" }] },
      {},
    ),
    [{ kind: "source", attribute: "xlink:href", value: "any.svg" }],
  );
});

test("derived references drop partial attributes and text, preserve copies and producer insertions", () => {
  const source =
    '<img src="whole.svg"><img src="partial.svg"><style>a{background:url(cut.svg)}</style><template><img src="exposed.svg"><template><img src="hidden.svg"></template></template>';
  const analysis = new PageAnalysis(source, "page.html");
  const partial = analysis.references.find(
    ({ value }) => value === "partial.svg",
  )!;
  const style = analysis.references.find(({ value }) => value === "cut.svg")!;
  const outer = source.indexOf("<template>") + "<template>".length;
  const copy = { start: outer, end: source.lastIndexOf("</template>") };
  const recipe = [
    { kind: "source" as const, start: 0, end: partial.start + 1 },
    { kind: "insert" as const, text: "x", references: ["inserted.svg"] },
    { kind: "source" as const, start: partial.start + 2, end: style.start + 1 },
    { kind: "insert" as const, text: "x", references: [] },
    { kind: "source" as const, start: style.start + 2, end: source.length },
    { kind: "source" as const, ...copy, copy },
    { kind: "source" as const, ...copy, copy },
  ];
  assert.deepEqual(analysis.materialReferences(recipe, []), [
    "whole.svg",
    "inserted.svg",
    "exposed.svg",
    "exposed.svg",
  ]);
});

test("source recovery is normative: a discarded select image cannot be fabricated by a copied slot", () => {
  const source = '<select><img src="discarded.svg"></select>';
  const analysis = new PageAnalysis(source, "page.html");
  const copy = {
    start: source.indexOf("<img"),
    end: source.indexOf("</select>"),
  };
  assert.deepEqual(
    analysis.materialReferences([{ kind: "source", ...copy, copy }], []),
    [],
  );
  assert.deepEqual(delivered(source.slice(copy.start, copy.end)).resources, [
    "discarded.svg",
  ]);
});

test("copies expose only omitted inert wrappers and drop paired ignored records", () => {
  const source =
    '<template><img src="exposed.svg"><template><img src="nested.svg"></template><!--mokly-review-ignore:start:copy--><img src="ignored.svg"><!--mokly-review-ignore:end:copy--></template>';
  const analysis = new PageAnalysis(source, "page.html");
  const outer = { start: 0, end: source.length };
  const inner = {
    start: source.indexOf("<img"),
    end: source.lastIndexOf("</template>"),
  };
  const copied = (copy: typeof inner) => [
    { kind: "source" as const, ...copy, copy },
  ];
  assert.deepEqual(
    analysis.materialReferences(copied(outer), []),
    [],
    "keeping the outer template hides every reference",
  );
  assert.deepEqual(
    analysis.materialReferences(copied(inner), []),
    ["exposed.svg", "ignored.svg"],
    "omitting the outer wrapper exposes only its direct records",
  );
  assert.deepEqual(
    analysis.materialReferences(copied(inner), ["copy"]),
    ["exposed.svg"],
    "paired ignored copies supply no references",
  );
  const nested = {
    start: source.indexOf('<img src="nested'),
    end: source.indexOf("</template>"),
  };
  assert.deepEqual(
    analysis.materialReferences(copied(nested), []),
    ["nested.svg"],
    "omitting both wrappers exposes the nested subtree",
  );
});
