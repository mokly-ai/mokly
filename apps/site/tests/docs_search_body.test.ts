import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { type DefaultTreeAdapterMap, parse } from "parse5";

import { attribute, byClass, elements } from "./helpers/html.js";

type Element = DefaultTreeAdapterMap["element"];

/**
 * Whether search indexes an element: the indexer reads only the parts
 * marked `data-pagefind-body`, and skips each part marked
 * `data-pagefind-ignore` inside them.
 */
function indexed(element: Element): boolean {
  for (
    let node: DefaultTreeAdapterMap["parentNode"] | null = element;
    node !== null && "tagName" in node;
    node = node.parentNode
  ) {
    if (attribute(node, "data-pagefind-ignore") !== undefined) return false;
    if (attribute(node, "data-pagefind-body") !== undefined) return true;
  }
  return false;
}

function only(found: readonly Element[], name: string): Element {
  assert.equal(found.length, 1, name);
  return found[0]!;
}

test("search indexes a docs page's title, lead and document, and none of its chrome", async () => {
  const document = parse(
    await readFile(
      path.resolve(
        import.meta.dirname,
        "..",
        "dist",
        "docs",
        "start",
        "install",
        "index.html",
      ),
      "utf8",
    ),
  );
  const tagged = (tagName: string, label?: string) =>
    elements(
      document,
      (element) =>
        element.tagName === tagName &&
        (label === undefined || attribute(element, "aria-label") === label),
    );
  const body = only(byClass(document, "site-document-body"), "the document");
  const heading = elements(body, (element) => element.tagName === "h2")[0];
  assert.ok(heading, "the document has an h2");
  for (const [name, element] of [
    ["the title", only(tagged("h1"), "the title")],
    ["the lead", only(byClass(document, "site-pullquote"), "the lead")],
    ["the document", heading],
  ] as const) {
    assert.equal(indexed(element), true, name);
  }
  for (const [name, found] of [
    ["the frame label", byClass(document, "site-frame-name")],
    ["the trail", tagged("nav", "Location")],
    ["On this page", tagged("details")],
    ["the pager", tagged("nav", "Pagination")],
    ["the Layers trees", tagged("nav", "Documentation")],
    ["the Inspect panel", tagged("aside", "Inspect")],
    ["the sub-bar", byClass(document, "site-docs-subbar")],
  ] as const) {
    assert.ok(found.length > 0, `${name} is on the page`);
    for (const element of found) assert.equal(indexed(element), false, name);
  }
});
