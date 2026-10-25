import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogueReadModel } from "../src/catalogue/types.js";
import { homeSummary } from "../src/shell/home_summary.js";

import { indexFixture } from "./catalogue_v7_fixture.js";
import { standaloneMarkup } from "./shell_markup.js";

/** The summary line the home page renders, or undefined without one. */
function homeNote(index: CatalogueReadModel): string | undefined {
  const html = standaloneMarkup({ index });
  return /<p class="mbk-empty-note">([^<]*)<\/p>/u.exec(
    html.replaceAll("<!-- -->", ""),
  )?.[1];
}

test("home counts every current entry kind, documents included", () => {
  assert.equal(
    homeNote(indexFixture()),
    "3 screens · 2 components · 1 user flow · 1 catalogue page · 1 document",
  );
});

test("home omits kinds with no current entries", () => {
  const documentsOnly = indexFixture((index) => {
    index.screens = [];
    index.components = [];
    index.pages = [];
    index.useCases = [];
    index.removedEntries = [];
    index.tree = index.tree.flatMap((node) =>
      node.kind === "folder" && node.path === "product"
        ? [{ ...node, children: node.children.slice(0, 1) }]
        : [],
    );
  });
  assert.equal(homeNote(documentsOnly), "1 document");
});

test("the summary lists kinds in order, says one entry in the singular, and needs entries", () => {
  const entries = (...kinds: string[]) =>
    kinds.map((kind) => ({ kind })) as Parameters<typeof homeSummary>[0];
  assert.equal(
    homeSummary(entries("document", "component", "component", "screen")),
    "1 screen · 2 components · 1 document",
  );
  assert.equal(
    homeSummary(entries("use-case", "page")),
    "1 user flow · 1 catalogue page",
  );
  assert.equal(homeSummary([]), undefined);
});
