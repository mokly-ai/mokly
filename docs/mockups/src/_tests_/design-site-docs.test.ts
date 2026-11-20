import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SECTION_IDS,
  SECTION_TITLES,
} from "../../../../apps/site/src/docs/sections";

import { installedVersion, one, type Root } from "./design-site-docs-helpers";
import {
  assertHoverChangesMoreThanColor,
  assertStrongBoundaries,
  attribute,
  byClass,
  childElements,
  cssRules,
  elements,
  label,
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
  "site-panel-row",
  "site-onpage-link",
  "site-docs-edit",
  "site-docs-layers-toggle",
  "site-docs-outline-summary",
  "site-docs-sample-option",
  "site-pager-item",
];

/** Each link of `root`: its text and the catalogue entry it opens. */
function links(root: Root) {
  return elements(root, (node) => node.tagName === "a").map((node) => [
    label(node),
    attribute(node, "data-mokly-link"),
  ]);
}

/** The documentation tree: in the Layers panel, or in the open sheet. */
function tree(viewport: "mobile" | "desktop") {
  const id =
    viewport === "desktop" ? "design/site/docs" : "design/site/docs/layers";
  return one(siteDocument(id, viewport).document, "site-doc-tree");
}

for (const viewport of ["mobile", "desktop"] as const) {
  test(`${viewport}: the Layers tree lists every section and selects the open page`, () => {
    const layers = tree(viewport);
    assert.equal(layers.tagName, "nav");
    assert.equal(attribute(layers, "aria-label"), "Documentation");
    const titles = byClass(layers, "site-doc-section-head").map((head) =>
      label(childElements(head)[0]!),
    );
    assert.deepEqual(titles, sections);
    assert.deepEqual([...titles].sort(), [...contractedSections].sort());
    for (const section of byClass(layers, "site-doc-section"))
      assert.equal(
        label(one(section, "site-docs-section-count")),
        String(byClass(section, "site-panel-row").length),
        label(section),
      );
    const current = elements(
      layers,
      (node) => attribute(node, "aria-current") !== undefined,
    );
    assert.deepEqual(current.map(label), ["Install"]);
    assert.equal(attribute(current[0]!, "aria-current"), "page");
    // The pages that a mockup draws link it; every other page is plain text.
    assert.deepEqual(links(layers), [
      ["Mokly CLI" + installedVersion(), "design/site/changelog"],
      ["Install", "design/site/docs"],
      ["Your first screen", "design/site/docs/first-screen"],
      ["Changelog", "design/site/changelog"],
    ]);
    assert.equal(label(one(layers, "site-doc-tree-foot")), "Changelog");
  });

  test(`${viewport}: documentation search sits with the tree, not in the tool bar`, () => {
    const { document } = siteDocument("design/site/docs", viewport);
    const header = one(document, "site-header");
    assert.equal(byClass(header, "site-search").length, 0);
    const search = one(document, "site-search");
    assert.equal(search.tagName, "button");
    assert.equal(attribute(search, "aria-haspopup"), "dialog");
    assert.deepEqual(attribute(search, "aria-keyshortcuts")?.split(" "), [
      "Control+K",
      "Meta+K",
      "/",
    ]);
    const name =
      viewport === "desktop" ? "site-search-label" : "site-visually-hidden";
    assert.equal(label(one(search, name)), "Search docs");
    const holder =
      viewport === "desktop" ? "site-docs-layers-top" : "site-docs-subbar";
    const held = byClass(one(document, holder), "site-search");
    assert.equal(held.length, 1, holder);
    assert.equal(held[0], search, holder);
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

test("the installed package version heads only the documentation tree", () => {
  for (const viewport of ["mobile", "desktop"] as const)
    assert.deepEqual(byClass(tree(viewport), "site-version").map(label), [
      "Mokly CLI" + installedVersion(),
    ]);
  for (const id of siteScreens.filter((id) => id !== "design/site/docs"))
    assert.equal(
      byClass(siteDocument(id, "desktop").document, "site-version").length,
      0,
    );
});

test("the desktop Layers panel heads the tree with search and the version", () => {
  const layers = tree("desktop");
  assert.deepEqual(attribute(layers, "class")?.split(" "), [
    "site-panel",
    "site-doc-tree",
  ]);
  assert.equal(label(one(layers, "site-panel-title")), "Layers");
  assert.equal(label(one(layers, "site-panel-meta")), "Docs");
  assert.deepEqual(
    childElements(one(layers, "site-docs-layers-top")).map(
      (node) => attribute(node, "class")?.split(" ")[0],
    ),
    ["site-search", "site-version-link"],
  );
});

test("the mobile sub-bar names the page and opens the tree sheet", () => {
  const closed = siteDocument("design/site/docs", "mobile").document;
  const open = siteDocument("design/site/docs/layers", "mobile").document;
  for (const [document, expanded] of [
    [closed, "false"],
    [open, "true"],
  ] as const) {
    const toggle = one(
      one(document, "site-docs-subbar"),
      "site-docs-layers-toggle",
    );
    assert.equal(toggle.tagName, "button");
    assert.equal(label(toggle), "Getting started / Install");
    assert.equal(attribute(toggle, "aria-expanded"), expanded);
    assert.equal(attribute(toggle, "aria-controls"), "docs-layers");
  }
  assert.equal(byClass(closed, "site-docs-sheet").length, 0);
  const sheet = one(open, "site-docs-sheet");
  assert.equal(sheet.tagName, "dialog");
  assert.equal(attribute(sheet, "id"), "docs-layers");
  assert.equal(attribute(sheet, "aria-label"), "Layers");
  assert.equal(attribute(sheet, "open"), "");
  assert.equal(
    attribute(one(open, "site-docs-sheet-scrim"), "aria-hidden"),
    "true",
  );
  for (const id of ["design/site/docs", "design/site/docs/layers"]) {
    const desktop = siteDocument(id, "desktop").document;
    assert.equal(byClass(desktop, "site-docs-subbar").length, 0, id);
    assert.equal(byClass(desktop, "site-docs-sheet").length, 0, id);
    assert.equal(
      byClass(one(desktop, "site-docs-side"), "site-doc-tree").length,
      1,
      id,
    );
  }
});

test("every promised documentation control changes more than color on hover", () => {
  assertHoverChangesMoreThanColor(hoverClasses);
});

test("documentation control boundaries use the strong border role", () => {
  assertStrongBoundaries([
    ".site-search",
    ".site-docs-outline",
    ".site-docs-edit",
    ".site-pager-item",
  ]);
});

test("the Layers and Inspect panels stick below the tool bar and the tree scrolls in its panel", () => {
  const parsed = cssRules(siteStyles());
  const exact = (selector: string) => {
    const rule = parsed.find(
      (candidate) => candidate.selector.trim() === selector,
    );
    assert.ok(rule, selector);
    return rule.declarations;
  };
  for (const column of [".site-docs-side", ".site-docs-rail"]) {
    assert.match(exact(column), /position:\s*sticky/, column);
    assert.match(exact(column), /top:\s*\d+px/, column);
  }
  for (const panel of [".site-doc-tree", ".site-docs-inspect"])
    assert.match(exact(panel), /max-height:\s*calc\(100vh - \d+px\)/, panel);
  assert.match(exact(".site-doc-tree-scroll"), /overflow-y:\s*auto/);
  assert.match(
    exact(".site-doc-tree > .site-panel-body"),
    /flex-direction:\s*column/,
  );
});

test("split site styles own the documentation compositions", () => {
  assert.ok(siteStyles().includes(".site-doc-tree {"), ".site-doc-tree");
});
