import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";

import {
  attribute,
  documentElements,
  elements,
  textContent,
} from "./helpers/html.js";
import {
  assertAttributes,
  flatCss,
  requiredElement,
} from "./helpers/shell_assertions.js";
import {
  context,
  homePage,
  manifest,
  untaggedManifest,
  viewPage,
} from "./helpers/shell_fixture.js";

test("the search field carries a tag control over a closed picker", () => {
  const html = homePage(createCatalogue(manifest), context);
  const search = requiredElement(
    html,
    (element) => attribute(element, "data-mokly-search") !== undefined,
  );
  assertAttributes(search, {
    "aria-label": "Search catalogue",
    placeholder: "Search catalogue…",
    type: "search",
    value: "",
  });
  const toggle = requiredElement(
    html,
    (element) => attribute(element, "data-mokly-tag-toggle") !== undefined,
  );
  assertAttributes(toggle, {
    "aria-controls": "mb-tag-picker",
    "aria-expanded": "false",
    "aria-label": "Filter by tag",
    type: "button",
  });
  const picker = requiredElement(
    html,
    (element) => attribute(element, "data-mokly-tag-picker") !== undefined,
  );
  assertAttributes(picker, {
    "aria-label": "Tags",
    hidden: "",
    id: "mb-tag-picker",
    role: "group",
  });
  const tags = elements(
    picker,
    (element) => attribute(element, "data-mokly-tag") !== undefined,
  );
  assert.deepEqual(
    tags.map((tag) => ({
      pressed: attribute(tag, "aria-pressed"),
      tabIndex: attribute(tag, "tabindex"),
      tag: attribute(tag, "data-mokly-tag"),
      text: textContent(tag),
    })),
    [
      { pressed: "false", tabIndex: "0", tag: "billing", text: "billing" },
      { pressed: "false", tabIndex: "-1", tag: "forms", text: "forms" },
      {
        pressed: "false",
        tabIndex: "-1",
        tag: "onboarding",
        text: "onboarding",
      },
    ],
  );

  const untagged = homePage(createCatalogue(untaggedManifest), context);
  assert.equal(
    documentElements(
      untagged,
      (element) => attribute(element, "data-mokly-search") !== undefined,
    ).length,
    1,
  );
  assert.equal(
    documentElements(
      untagged,
      (element) =>
        attribute(element, "data-mokly-tag-toggle") !== undefined ||
        attribute(element, "data-mokly-tag-picker") !== undefined,
    ).length,
    0,
  );
});

test("the brand names itself and the search bar drops the wordmark", () => {
  const browse = homePage(createCatalogue(manifest), context);
  assert.ok(
    browse.includes(
      '<header class="mbk-topbar" data-compact-search="closed" data-search="">',
    ),
  );
  assert.match(
    browse,
    /aria-expanded="false" aria-label="Search catalogue" class="mbk-search-toggle"/,
  );
  assert.match(browse, /aria-label="Close search" class="mbk-search-close"/);
  const brand = browse.match(
    /<a aria-label="Mokly" class="mbk-brand" href="\/">(.*?)<\/a>/,
  )?.[1];
  assert.ok(brand);
  assert.match(
    brand,
    /^<span aria-hidden="true" class="mbk-mark"><svg aria-hidden="true" height="22" viewBox="0 0 32 32" width="22">/,
  );
  assert.ok(brand.endsWith('<span class="mbk-name">mokly.</span>'));
  assert.equal(brand.replace(/<[^>]*>/g, ""), "mokly.");

  assert.ok(
    flatCss(SHELL_CSS).includes(
      "@media (max-width: 56.25rem) { .mbk-menu { display: inline-flex; } " +
        ".mbk-topbar[data-search] .mbk-name { display: none; }",
    ),
  );
  assert.match(SHELL_CSS, /\.mbk-search \{[^}]*flex: 1;[^}]*min-width: 0;/);
  assert.match(SHELL_CSS, /\.mbk-mark \{[^}]*flex-shrink: 0;/);
});

test("the search field leads with a legible search icon, not a glyph", () => {
  const browse = homePage(createCatalogue(manifest), context);
  assert.ok(browse.includes("mbk-search"));
  assert.equal(browse.includes("\u2315"), false);
  assert.ok(
    browse.includes(
      '<div class="mbk-search">' +
        '<svg aria-hidden="true" fill="none" height="15" stroke="currentColor" ' +
        'stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ' +
        'viewBox="0 0 24 24" width="15">' +
        '<circle cx="11" cy="11" r="7"></circle>' +
        '<path d="M20 20l-3.9-3.9"></path></svg>',
    ),
  );
  assert.match(SHELL_CSS, /\.mbk-search > svg \{[^}]*flex-shrink: 0;/);
});

test("the browser bar draws copy and expand icons, not tiny glyphs", () => {
  const catalogue = createCatalogue(manifest);
  const entry = catalogue.byPath.get("example/screens/welcome");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeId: "example/screens/welcome",
  });
  for (const glyph of ["⧉", "⤢", "⤡"]) {
    assert.equal(html.includes(glyph), false);
    assert.equal(SHELL_CSS.includes(glyph), false);
  }
  assert.match(
    html,
    /class="address-copy"><svg aria-hidden="true" fill="none" height="13"[^>]*width="13">/,
  );
  assert.match(
    html,
    /class="i-expand"><svg aria-hidden="true" fill="none" height="13"[^>]*width="13">/,
  );
  assert.match(
    html,
    /class="i-collapse"><svg aria-hidden="true" fill="none" height="13"[^>]*width="13">/,
  );
  assert.match(
    SHELL_CSS,
    /\.address-copy \{[^}]*flex-shrink: 0;[^}]*margin-left: auto;/,
  );
  assert.match(SHELL_CSS, /\.address-url \{[^}]*text-overflow: ellipsis;/);
  assert.match(SHELL_CSS, /\.browser-expand \.i-collapse \{\s*display: none;/);
  assert.match(
    SHELL_CSS,
    /\.browser-frame\.is-expanded \.browser-expand \.i-collapse \{\s*display: inline-flex;/,
  );
});
