import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  attribute,
  byClass,
  designDocument,
  elements,
  textContent,
} from "./helpers/design_catalogue.js";
import { repositoryRoot } from "./helpers/fixture.js";

const DOCS = "design-site-docs";

const DOCS_SECTIONS = [
  "Getting started",
  "Authoring",
  "Catalogue",
  "CLI reference",
  "Continuous integration",
  "Mokly Cloud",
  "Reference",
  "Review and edit",
];

/** Every interactive class the site promises a hover state for. */
const HOVER_CLASSES = [
  "site-nav-link",
  "site-brand",
  "site-button--primary",
  "site-button--secondary",
  "site-button--quiet",
  "site-code-copy",
  "site-search",
  "site-link",
  "site-version-link",
  "site-footer-link",
  "site-doc-link",
  "site-onpage-link",
  "site-pager-item",
  "site-release-index-link",
  "site-release-link",
];

/** Hover must change more than color alone. */
const HOVER_PROPERTIES = [
  "background",
  "border",
  "text-decoration",
  "outline",
  "box-shadow",
];

function label(node: Parameters<typeof textContent>[0]): string {
  return textContent(node).replace(/\s+/g, " ").trim();
}

function stylesheet(file: string): Promise<string> {
  return fs.readFile(
    path.join(repositoryRoot, "examples/basic/generated", file),
    "utf8",
  );
}

/** Split a stylesheet into selector and declaration pairs, comments removed. */
function rules(source: string): { declarations: string; selector: string }[] {
  const found: { declarations: string; selector: string }[] = [];
  const declared = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = pattern.exec(declared);
  while (match) {
    found.push({ declarations: match[2]!, selector: match[1]! });
    match = pattern.exec(declared);
  }
  return found;
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the documentation tree lists every section expanded`, async () => {
    const { document } = await designDocument(DOCS, viewport);
    const tree = byClass(document, "site-doc-tree")[0];
    assert.ok(tree, "the tree renders in both compositions");
    assert.equal(
      elements(tree, (node) => node.tagName === "details").length,
      0,
      "no section hides behind a disclosure",
    );
    const sections = byClass(tree, "site-doc-section");
    assert.deepEqual(
      sections.map((section) =>
        label(byClass(section, "site-doc-section-head")[0]!),
      ),
      DOCS_SECTIONS,
    );
    assert.equal(
      byClass(tree, "site-rubric").length,
      DOCS_SECTIONS.length,
      "every section head is set as a rubric",
    );
    const current = byClass(tree, "site-doc-link--current");
    assert.equal(current.length, 1);
    assert.equal(label(current[0]!), "Install");
    assert.equal(attribute(current[0]!, "aria-current"), "page");
    const foot = byClass(tree, "site-doc-tree-foot")[0];
    assert.ok(foot, "the tree closes with the changelog link");
    assert.equal(label(foot), "Changelog");
    assert.equal(
      byClass(document, "site-docs-side").length,
      viewport === "desktop" ? 1 : 0,
      "the canvas column belongs to the desktop composition",
    );
    const disclosure = byClass(document, "site-doc-disclosure")[0];
    if (viewport === "desktop") {
      assert.equal(disclosure, undefined);
      return;
    }
    assert.ok(disclosure, "below the breakpoint the tree is a disclosure");
    assert.equal(disclosure.tagName, "details");
    assert.equal(
      label(elements(disclosure, (node) => node.tagName === "summary")[0]!),
      "Getting started›Install",
    );
  });

  test(`${viewport}: the document reads as a ruled column with its own rail`, async () => {
    const { document } = await designDocument(DOCS, viewport);
    const main = byClass(document, "site-docs-document")[0];
    assert.ok(main, "the document column carries the reading measure");
    assert.equal(attribute(main, "id"), "main");
    const intro = byClass(main, "site-document-intro")[0];
    assert.ok(intro);
    assert.equal(
      label(byClass(intro, "site-trail")[0]!),
      "Documentation›Getting started",
      "the location trail is the eyebrow above the title",
    );
    assert.equal(
      label(elements(intro, (node) => node.tagName === "h1")[0]!),
      "Install",
    );
    assert.equal(
      label(byClass(intro, "site-pullquote")[0]!),
      "Add Mokly to the repository that holds your components.",
      "the lead is set as the accent-ruled pull quote",
    );

    const copy = byClass(document, "site-code-copy");
    assert.equal(copy.length, 1);
    assert.equal(label(copy[0]!), "Copy");
    assert.match(
      label(byClass(document, "site-code-body")[0]!),
      /npm install --save-dev @mokly\/mokly react react-dom/,
    );

    const onPage = byClass(document, "site-onpage");
    assert.equal(onPage.length, 1);
    assert.deepEqual(
      byClass(onPage[0]!, "site-onpage-link").map((node) =>
        attribute(node, "href"),
      ),
      [
        "#install-the-package",
        "#add-the-configuration",
        "#author-your-first-screen",
      ],
    );
    assert.equal(
      byClass(document, "site-docs-rail").length,
      viewport === "desktop" ? 1 : 0,
      "the rail hangs beside the document only on the wide composition",
    );
    assert.equal(
      label(byClass(document, "site-pager")[0]!),
      "PreviousGetting startedNextConfigure",
    );
    assert.equal(byClass(document, "site-pager-item").length, 2);
  });
}

test("the documentation search control sits in the header", async () => {
  for (const viewport of ["mobile", "desktop"] as const) {
    const { document } = await designDocument(DOCS, viewport);
    const header = byClass(document, "site-header")[0];
    assert.ok(header);
    const search = byClass(header, "site-search");
    assert.equal(search.length, 1, viewport);
    assert.match(label(search[0]!), /Search docs/);
    assert.equal(search[0]!.tagName, "button");
  }
});

test("every interactive control changes more than color on hover", async () => {
  const source = await stylesheet("site.css");
  const parsed = rules(source);
  for (const className of HOVER_CLASSES) {
    const matching = parsed.filter((rule) =>
      rule.selector.includes(`.${className}:hover`),
    );
    assert.ok(matching.length > 0, `site.css hovers .${className}`);
    assert.ok(
      matching.some((rule) =>
        HOVER_PROPERTIES.some((property) =>
          rule.declarations.includes(`${property}`),
        ),
      ),
      `.${className}:hover changes more than color alone`,
    );
  }
});

test("the shared focus ring stays visible on every control", async () => {
  const source = await stylesheet("site.css");
  const focus = rules(source).find((rule) =>
    rule.selector.includes(":focus-visible"),
  );
  assert.ok(focus, "site.css keeps the focus-visible ring");
  assert.match(focus.declarations, /outline: var\(--site-focus-width\)/);
  assert.match(focus.declarations, /var\(--site-focus\)/);
  assert.match(
    focus.declarations,
    /outline-offset: var\(--site-focus-offset\)/,
  );
});

test("the documentation tree sits on the page canvas behind a hairline", async () => {
  const source = await stylesheet("site.css");
  const parsed = rules(source);
  const side = parsed.find(
    (rule) => rule.selector.trim() === ".site-docs-side",
  );
  assert.ok(side, "the tree column is declared");
  assert.match(
    side.declarations,
    /border-right: 1px solid var\(--site-folio-line\)/,
    "one hairline separates the tree from the document",
  );
  const tree = parsed.find(
    (entry) => entry.selector.trim() === ".site-doc-tree",
  );
  assert.ok(tree);
  assert.match(tree.declarations, /position:\s*sticky/);
  const scroll = parsed.find(
    (entry) => entry.selector.trim() === ".site-doc-tree-scroll",
  );
  assert.ok(scroll);
  assert.match(scroll.declarations, /overflow-y:\s*auto/);
  const band = parsed.find((entry) => entry.selector.trim() === ".site-band");
  assert.ok(band);
  assert.doesNotMatch(band.declarations, /background:\s*var/);
  for (const selector of [".site-docs-side", ".site-doc-tree"]) {
    const rule = parsed.find((entry) => entry.selector.trim() === selector);
    assert.ok(rule, selector);
    assert.ok(
      !/(^|\s)background:/.test(rule.declarations),
      `${selector} is not a filled panel`,
    );
  }
  const rail = parsed.find(
    (rule) => rule.selector.trim() === ".site-docs-rail",
  );
  assert.ok(rail);
  assert.match(
    rail.declarations,
    /border-left: 1px solid var\(--site-folio-line\)/,
    "the on-this-page rail hangs from its own hairline",
  );
  const link = parsed.find((rule) => rule.selector.trim() === ".site-doc-link");
  assert.ok(link);
  assert.match(link.declarations, /min-height: var\(--site-target-min\)/);
  const current = parsed.find((rule) =>
    rule.selector.includes(".site-doc-link--current,"),
  );
  assert.ok(current, "the current page keeps the accent fill");
  assert.match(current.declarations, /background: var\(--site-accent-soft\)/);
  assert.match(current.declarations, /color: var\(--site-accent\)/);
});
