import assert from "node:assert/strict";
import test from "node:test";

import { createCatalogue } from "../packages/viewer/dist/shell/catalogue.js";
import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";

import { flatCss } from "./helpers/shell_css.js";
import {
  context,
  homePage,
  manifest,
  viewPage,
} from "./helpers/shell_fixture.js";

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

test("both split dividers share one grip affordance", () => {
  const css = flatCss(SHELL_CSS);
  for (const grip of [
    '.mbk-nav-resize::after { content: ""; position: absolute; ' +
      "top: calc(50% - 16px); left: 3px; width: 2px; height: 32px; " +
      "border-radius: 999px; background: var(--chrome-border-strong); " +
      "transition: background 120ms ease, box-shadow 120ms ease; }",
    '.mbk-inspector-resize::after { content: ""; position: absolute; ' +
      "top: 7px; left: calc(50% - 16px); width: 32px; height: 2px; " +
      "border-radius: 999px; background: var(--chrome-border-strong); " +
      "transition: background 120ms ease, box-shadow 120ms ease; }",
  ])
    assert.ok(css.includes(grip), grip);
  assert.ok(
    css.includes(
      ".mbk-inspector-resize { position: absolute; z-index: 2; top: -8.5px; " +
        "right: 0; left: 0; display: none; height: 16px;",
    ),
    "the handle clears the 1px border its padding box hides",
  );
  for (const handle of ["nav", "inspector"])
    for (const state of [
      `.mbk-${handle}-resize:hover::after,`,
      `.mbk-${handle}-resize:focus-visible::after,`,
      `[data-mokly-shell].mbk-${handle}-resizing ` +
        `.mbk-${handle}-resize::after ` +
        "{ background: var(--mokly-accent); " +
        "box-shadow: 0 0 0 3px var(--mokly-accent-soft); }",
    ])
      assert.ok(css.includes(state), `${handle}: ${state}`);
  assert.ok(
    css.includes(
      ".mbk-inspector-resize:focus-visible " +
        "{ box-shadow: inset 0 2px 0 var(--mokly-accent); }",
    ),
  );
  assert.equal(
    css.includes(".mbk-inspector-resize:focus-visible { outline"),
    false,
  );
  for (const axis of ["col", "row"]) {
    const scope = axis === "col" ? "nav" : "inspector";
    assert.ok(
      css.includes(
        `[data-mokly-shell].mbk-${scope}-resizing * ` +
          `{ cursor: ${axis}-resize !important; }`,
      ),
      scope,
    );
    assert.ok(
      css.includes(
        `[data-mokly-shell].mbk-${scope}-resizing iframe ` +
          "{ pointer-events: none; }",
      ),
      scope,
    );
  }
  assert.match(
    SHELL_CSS,
    /@media \(max-width: 56\.25rem\) \{[\s\S]*\.mbk-inspector\[data-open="true"\] \.mbk-inspector-resize \{[\s\S]*display: none;/,
  );
});
