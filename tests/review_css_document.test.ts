import assert from "node:assert/strict";
import test from "node:test";

import { parse as parseSelector } from "css-what";
import { parse } from "parse5";

import { cssDocumentOptions } from "../src/review/css/document.js";
import {
  matchesDocument,
  selectDocument,
} from "../src/review/css/document_query.js";

import { analyze, documents, excluded, kept } from "./helpers/review_css.js";

test("CSS adapter preserves root siblings, text, and ancestor subset semantics", () => {
  const document = parse(
    "<!doctype html><main><!-- note --><span>One</span>Two</main>",
  );
  const adapter = cssDocumentOptions(document).adapter!;
  const html = document.childNodes.find(adapter.isTag)!;
  const body = html.childNodes.find(
    (node) => adapter.isTag(node) && node.tagName === "body",
  )!;
  assert.deepEqual(adapter.getSiblings(document), [document]);
  assert.equal(adapter.getText(document), "OneTwo");
  assert.deepEqual(adapter.removeSubsets([body, html, document, body]), [
    document,
  ]);
});

test("CSS matching preserves foreign tag and attribute case through negation", () => {
  const pair = documents(
    '<!doctype html><MAIN><svg viewBox="0 0 10 10"><linearGradient id="paint"/></svg></MAIN>',
  );
  for (const selector of [
    "MAIN svg linearGradient:not(lineargradient)",
    "svg[viewBox]:not([viewbox])",
    "linearGradient:not(LINEARGRADIENT)",
  ])
    assert.deepEqual(
      analyze("", `${selector}{color:red}`, pair),
      kept("matched", selector),
    );
  for (const selector of ["lineargradient", "svg[viewbox]", "main:not(MAIN)"])
    assert.deepEqual(analyze("", `${selector}{color:red}`, pair), excluded);
});

test("CSS queries preserve foreign case in nth-of selectors and ignore HTML attribute case", () => {
  const pair = documents(
    '<!doctype html><main DATA-STATE="Ready"><svg><linearGradient/><linearGradient/></svg></main>',
  );
  assert.deepEqual(
    analyze("", 'MAIN[DATA-STATE="Ready"]{color:red}', pair),
    kept("matched", 'MAIN[DATA-STATE="Ready"]'),
  );
  assert.deepEqual(
    analyze(
      "",
      "linearGradient:nth-child(2 of linearGradient){color:red}",
      pair,
    ),
    kept("matched", "linearGradient:nth-child(2 of linearGradient)"),
  );
});

test("CSS document selection shares matching rewrites and returns every element", () => {
  const document = parse(
    '<!doctype html><button class="target"></button><button class="target"></button>',
    { sourceCodeLocationInfo: true },
  );
  const query = parseSelector(".target:hover");
  assert.equal(matchesDocument(query, document), true);
  const matches = selectDocument(query, document);
  assert.equal(matches.length, 2);
  assert.ok(matches.every((element) => element.sourceCodeLocation));
});
