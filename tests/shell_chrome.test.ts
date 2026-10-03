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
  context,
  flatCss,
  homePage,
  manifest,
  notFoundPage,
  untaggedManifest,
  viewPage,
} from "./shell_fixture.js";
import { assertAttributes, requiredElement } from "./shell_fixture_2.js";

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
  const entry = catalogue.byId.get("welcome");
  assert.ok(entry);
  const html = viewPage(entry, catalogue, {
    ...context,
    activeId: "welcome",
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

test("missing routes keep the catalogue shell", () => {
  const catalogue = createCatalogue(manifest);
  const missing = notFoundPage("view/unknown.html", catalogue, context);
  assert.match(missing, /Item not found/);
  assert.match(missing, /choose another item from the navigation/);
  assert.match(missing, /If this item was just added/);
  assert.match(missing, /aria-label="Catalogue"/);
});

test("filter renders in the nav only when changed routes are known", () => {
  const catalogue = createCatalogue(manifest);
  const withFilter = homePage(catalogue, {
    ...context,
    changedIds: ["welcome"],
  });
  assert.match(withFilter, /data-mokly-filter/);
  assert.match(withFilter, /class="mbk-nav-filter-count">1</);
  const withNoChanges = homePage(catalogue, {
    ...context,
    changedIds: [],
  });
  assert.match(withNoChanges, /data-mokly-filter/);
  assert.match(withNoChanges, /class="mbk-nav-filter-count">0</);
  const withoutFilter = homePage(catalogue, context);
  assert.equal(withoutFilter.includes("data-mokly-filter"), false);
  assert.match(withoutFilter, /data-mokly-search/);
});

test("shell stylesheet stays aligned with the design contract", () => {
  assert.match(SHELL_CSS, /--_mokly-private-accent-default: #4f7864/);
  assert.match(SHELL_CSS, /--mb-added: var\(--mbk-accent-deep\)/);
  assert.match(SHELL_CSS, /--mbk-dark-screen-bg: #121514/);
  assert.match(SHELL_CSS, /--mbk-dark-screen-ink: #eef1ef/);
  assert.match(SHELL_CSS, /color-scheme: light/);
  assert.match(SHELL_CSS, /width: 390px/);
  assert.match(SHELL_CSS, /max-width: 1180px/);
  assert.match(SHELL_CSS, /max-width: 56\.25rem/);
  assert.match(SHELL_CSS, /width: var\(--mbk-nav-width, 248px\)/);
  assert.match(
    SHELL_CSS,
    /\.mbk-nav-section-head \{[^}]*text-transform: uppercase;[^}]*cursor: pointer;/,
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-nav-section\[open\][^{]*\.mbk-nav-section-chevron \{[^}]*transform: rotate\(90deg\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-nav\[data-resize-ready\] \.mbk-nav-resize \{[\s\S]*display: block;/,
  );
  assert.match(
    SHELL_CSS,
    /@media \(max-width: 56\.25rem\) \{[\s\S]*\.mbk-nav-resize \{[\s\S]*display: none;/,
  );
  assert.match(
    SHELL_CSS,
    /\.phone-status \{[\s\S]*flex: 0 0 44px;[\s\S]*padding: 14px 28px 0;/,
  );
  assert.match(SHELL_CSS, /\.phone-screen \{[\s\S]*flex-direction: column;/);
  assert.match(
    SHELL_CSS,
    /\.phone-screen \.mbk-frag \{[\s\S]*border-radius: 0 0 36px 36px;/,
  );

  assert.match(SHELL_CSS, /prefers-reduced-motion/);
  assert.match(SHELL_CSS, /InterVariable\.woff2/);
  assert.match(SHELL_CSS, /\.mbk-idchip \{[\s\S]*cursor: pointer;/);
  assert.match(
    SHELL_CSS,
    /\.mbk-idchip:active \{[\s\S]*transform: translateY\(1px\);/,
  );
});
