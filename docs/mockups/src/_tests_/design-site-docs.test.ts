import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SECTION_IDS,
  SECTION_TITLES,
} from "../../../../apps/site/src/docs/sections";

import {
  attribute,
  byClass,
  elements,
  label,
  siteDocument,
  siteStyles,
} from "./design-site-test-helpers";

const sections = SECTION_IDS.map((id) => SECTION_TITLES[id]);

const hoverClasses = [
  "site-nav-link",
  "site-menu-button",
  "site-menu-close",
  "site-menu-link",
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

interface CssRule {
  declarations: string;
  selector: string;
}

function rules(source: string): CssRule[] {
  const found: CssRule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (let match = pattern.exec(css); match; match = pattern.exec(css))
    found.push({ declarations: match[2]!, selector: match[1]! });
  return found;
}

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
}

test("documentation search remains in the shared header", () => {
  for (const viewport of ["mobile", "desktop"] as const) {
    const { document } = siteDocument("design/site/docs", viewport);
    const header = byClass(document, "site-header")[0];
    assert.ok(header);
    const search = byClass(header, "site-search");
    assert.equal(search.length, 1);
    assert.equal(search[0]!.tagName, "button");
    assert.match(label(search[0]!), /Search docs/);
  }
});

test("every promised interactive class changes more than color on hover", () => {
  const parsed = rules(siteStyles());
  for (const className of hoverClasses) {
    const matching = parsed.filter((rule) =>
      rule.selector.includes(`.${className}:hover`),
    );
    assert.ok(matching.length > 0, `missing hover for .${className}`);
    assert.ok(
      matching.some((rule) =>
        /(?:background|border|text-decoration|outline|box-shadow)/.test(
          rule.declarations,
        ),
      ),
      `.${className}:hover changes only color`,
    );
  }
});

test("focus and meaningful control boundaries use semantic tokens", () => {
  const parsed = rules(siteStyles());
  const focus = parsed.find((rule) => rule.selector.includes(":focus-visible"));
  assert.ok(focus);
  assert.match(
    focus.declarations,
    /outline: 2px solid var\(--mk-color-focus\)/,
  );
  assert.match(focus.declarations, /outline-offset: 3px/);

  for (const selector of [
    ".site-search",
    ".site-button--quiet",
    ".site-doc-disclosure",
    ".site-version",
  ]) {
    const rule = parsed.find((candidate) =>
      candidate.selector.split(",").some((part) => part.trim() === selector),
    );
    assert.ok(rule, selector);
    assert.match(rule.declarations, /--mk-color-border-strong/, selector);
  }
});

test("documentation rails sit on the page canvas behind hairlines", () => {
  const parsed = rules(siteStyles());
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
