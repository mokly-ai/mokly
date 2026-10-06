import assert from "node:assert/strict";
import test from "node:test";

import { PageAnalysis } from "../dist/review/page_analysis.js";

for (const [source, open] of [
  ["<!doctype html><html><body></body></html><svg>", true],
  ["<!doctype html><html><body></body></html><math>", true],
  ["<svg><g>", true],
  ["<math><mi>", true],
  ["<svg></svg>", false],
  ["<math></math>", false],
  ["<svg/>", false],
  ["<style>.entry::before{content:'<svg>'}</style>", false],
  ['<p data-value="<math>"><!-- <svg> --></p>', false],
] as const)
  test(`original parser EOF foreign state: ${source}`, () => {
    const page = new PageAnalysis(source, "home/index.html");
    assert.equal(page.openForeignContent, open);
    assert.equal(
      page.openForeignContent,
      open,
      "state is stable on repeated reads",
    );
  });
