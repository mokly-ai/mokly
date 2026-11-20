import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  SECTION_IDS,
  SECTION_TITLES,
} from "../../../../apps/site/src/docs/sections";

import {
  assertHoverChangesMoreThanColor,
  assertStrongBoundaries,
  attribute,
  byClass,
  childElements,
  cssRules,
  elements,
  label,
  repositoryRoot,
  siteDocument,
  siteScreens,
  siteStyles,
} from "./design-site-test-helpers";

const sections = SECTION_IDS.map((id) => SECTION_TITLES[id]);

/** The documentation sections that the contract names, in any order. */
const contractedSections = [
  "Getting started",
  "Authoring",
  "Catalogue",
  "CLI reference",
  "Continuous integration",
  "Mokly Cloud",
  "Reference",
  "Review and edit",
];

/** The documentation's controls, each of which promises a hover state. */
const hoverClasses = [
  "site-code-copy",
  "site-search",
  "site-version-link",
  "site-doc-link",
  "site-onpage-link",
  "site-pager-item",
];

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: documentation tree lists every section expanded`, () => {
    const { document } = siteDocument("design/site/docs", viewport);
    const tree = byClass(document, "site-doc-tree")[0];
    assert.ok(tree);
    assert.deepEqual(
      byClass(tree, "site-doc-section-head").map(label),
      sections,
    );
    assert.deepEqual(byClass(tree, "site-doc-link--current").map(label), [
      "Install",
    ]);
    assert.equal(
      attribute(byClass(tree, "site-doc-link--current")[0]!, "aria-current"),
      "page",
    );
    assert.equal(label(byClass(tree, "site-doc-tree-foot")[0]!), "Changelog");

    const disclosure = byClass(document, "site-doc-disclosure")[0];
    if (viewport === "desktop") assert.equal(disclosure, undefined);
    else {
      assert.ok(disclosure);
      assert.equal(disclosure.tagName, "details");
      assert.equal(
        label(elements(disclosure, (node) => node.tagName === "summary")[0]!),
        "Getting started›Install",
      );
    }
  });

  test(`${viewport}: document is one ruled column with contextual navigation`, () => {
    const { document } = siteDocument("design/site/docs", viewport);
    const main = byClass(document, "site-docs-document")[0];
    assert.ok(main);
    assert.equal(attribute(main, "id"), "main");
    assert.equal(
      label(byClass(main, "site-trail")[0]!),
      "Documentation›Getting started",
    );
    assert.equal(
      label(elements(main, (node) => node.tagName === "h1")[0]!),
      "Install",
    );
    assert.equal(
      label(byClass(main, "site-pullquote")[0]!),
      "Add Mokly to the repository that holds your components.",
    );
    assert.equal(byClass(document, "site-code-copy").map(label).join(), "Copy");
    assert.equal(byClass(document, "site-onpage").length, 1);
    assert.equal(
      byClass(document, "site-docs-rail").length,
      viewport === "desktop" ? 1 : 0,
    );
    assert.equal(
      label(byClass(document, "site-pager")[0]!),
      "PreviousGetting startedNextConfigure",
    );
  });

  test(`${viewport}: documentation depicts the contracted architecture`, () => {
    const { document } = siteDocument("design/site/docs", viewport);
    const text = label(document);
    for (const section of [...contractedSections, "Changelog"])
      assert.ok(text.includes(section), `missing docs section: ${section}`);
    assert.ok(
      text.includes("npm install --save-dev @mokly/mokly react react-dom"),
    );
    assert.equal(byClass(document, "site-code-copy").map(label).join(), "Copy");
    assert.equal(byClass(document, "site-search").length, 1);
    assert.deepEqual(
      byClass(document, "site-onpage-link").map((node) =>
        attribute(node, "href"),
      ),
      [
        "#install-the-package",
        "#add-the-configuration",
        "#author-your-first-screen",
      ],
    );
    assert.equal(
      byClass(document, "site-docs-side").length,
      viewport === "desktop" ? 1 : 0,
    );
    assert.equal(
      byClass(document, "site-doc-disclosure").length,
      viewport === "mobile" ? 1 : 0,
    );
  });

  test(`${viewport}: only the documentation draws the search control`, () => {
    for (const id of siteScreens) {
      const { document } = siteDocument(id, viewport);
      assert.equal(
        byClass(document, "site-search").length,
        id === "design/site/docs" ? 1 : 0,
        id,
      );
    }
  });
}

test("documentation search heads the documentation tree column", () => {
  for (const viewport of ["mobile", "desktop"] as const) {
    const { document } = siteDocument("design/site/docs", viewport);
    const header = byClass(document, "site-header")[0];
    assert.ok(header);
    assert.equal(byClass(header, "site-search").length, 0, viewport);
    const docs = byClass(document, "site-docs")[0];
    assert.ok(docs);
    const search = byClass(docs, "site-search");
    assert.equal(search.length, 1, viewport);
    assert.equal(search[0]!.tagName, "button");
    assert.match(label(search[0]!), /Search docs/);
    // The desktop tree opens with the search; the mobile column opens with
    // it, above the tree's disclosure.
    const column =
      viewport === "desktop" ? byClass(docs, "site-doc-tree")[0]! : docs;
    assert.equal(childElements(column)[0], search[0], viewport);
  }
});

test("the installed package version heads only the documentation tree", () => {
  const packageVersion = JSON.parse(
    readFileSync(
      resolve(repositoryRoot, "node_modules/@mokly/mokly/package.json"),
      "utf8",
    ),
  ) as { version: string };
  for (const viewport of ["mobile", "desktop"] as const) {
    const { document } = siteDocument("design/site/docs", viewport);
    assert.deepEqual(byClass(document, "site-version").map(label), [
      "Mokly CLI" + packageVersion.version,
    ]);
  }
  for (const id of siteScreens.filter((id) => id !== "design/site/docs"))
    assert.equal(
      byClass(siteDocument(id, "desktop").document, "site-version").length,
      0,
    );
});

test("every promised documentation control changes more than color on hover", () => {
  assertHoverChangesMoreThanColor(hoverClasses);
});

test("documentation control boundaries use the strong border role", () => {
  assertStrongBoundaries([
    ".site-search",
    ".site-doc-disclosure",
    ".site-version",
  ]);
});

test("documentation rails sit on the page canvas behind hairlines", () => {
  const parsed = cssRules(siteStyles());
  const exact = (selector: string) =>
    parsed.find((rule) => rule.selector.trim() === selector);
  const side = exact(".site-docs-side");
  const tree = exact(".site-doc-tree");
  const scroll = exact(".site-doc-tree-scroll");
  const rail = exact(".site-docs-rail");
  assert.ok(side);
  assert.ok(tree);
  assert.ok(scroll);
  assert.ok(rail);
  assert.match(
    side.declarations,
    /border-right: 1px solid var\(--mk-color-border\)/,
  );
  assert.doesNotMatch(side.declarations, /(?:^|\s)background:/);
  assert.doesNotMatch(tree.declarations, /(?:^|\s)background:/);
  assert.match(tree.declarations, /position:\s*sticky/);
  assert.match(scroll.declarations, /overflow-y:\s*auto/);
  assert.match(
    rail.declarations,
    /border-left: 1px solid var\(--mk-color-border\)/,
  );
});

test("split site styles own the documentation compositions", () => {
  assert.ok(siteStyles().includes(".site-doc-tree {"), ".site-doc-tree");
});
