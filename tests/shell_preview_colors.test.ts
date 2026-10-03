import assert from "node:assert/strict";
import test from "node:test";

import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";

import { darkTokenSelectors, flatCss } from "./helpers/shell_css.js";

test("dark scheme paints device screens and leaves the chrome light", () => {
  const css = flatCss(SHELL_CSS);
  const scope = '[data-preview-color-scheme="dark"] ';

  assert.ok(
    css.includes(
      `${scope}.phone-screen { background: var(--mbk-dark-screen-bg); }`,
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-screen::after { content: ""; position: absolute; ` +
        "inset: 0; border-radius: inherit; " +
        "box-shadow: inset 0 0 0 1px color-mix(in srgb, " +
        "var(--mbk-dark-screen-ink) 12%, var(--mbk-dark-screen-bg)); " +
        "pointer-events: none; }",
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-status { color: var(--mbk-dark-screen-ink); }`,
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.phone-home { background: color-mix(in srgb, ` +
        "var(--mbk-dark-screen-ink) 40%, transparent); }",
    ),
  );
  assert.ok(
    css.includes(
      `${scope}.browser-viewport { background: var(--mbk-dark-screen-bg); }`,
    ),
  );
  assert.match(
    css,
    /\[data-preview-color-scheme="dark"\] \.mbk-frag \{[^}]*background: var\(--mbk-dark-screen-bg\);/,
  );
  assert.match(
    css,
    /\[data-preview-color-scheme="dark"\] \.mbk-live-preparing \{ background: var\(--mbk-dark-screen-bg\);/,
  );
  assert.match(
    css,
    /\[data-preview-color-scheme="dark"\] \.mbk-live-preparing \.mbk-preview-spinner \{ border-color: color-mix\(in srgb, var\(--mbk-dark-screen-ink\)/,
  );

  const selectors = darkTokenSelectors(SHELL_CSS).map(flatCss);
  assert.equal(selectors.length, 9);
  for (const selector of selectors) {
    assert.ok(selector.startsWith(scope), selector);
  }
  assert.ok(
    css.includes(
      `${scope}.mb-pane-doc { background-color: var(--mbk-dark-screen-bg); }`,
    ),
  );

  assert.match(
    SHELL_CSS,
    /\.phone-screen \{[^}]*background: var\(--mbk-screen-bg\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.phone-status \{[^}]*color: var\(--mbk-screen-ink\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.phone-home \{[^}]*background: var\(--mbk-device-home\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.browser-viewport \{[^}]*background: var\(--mbk-screen-bg\);/,
  );
});

test("frame labels note a light-only screen only under a dark selection", () => {
  const css = flatCss(SHELL_CSS);
  assert.ok(
    css.includes(".mbk-frame-scheme-note { display: none; font-weight: 500; }"),
  );
  assert.ok(
    css.includes(
      'body[data-mokly-color-scheme="dark"] ' +
        ".mbk-frame-wrap[data-color-scheme-fallback] " +
        ".mbk-frame-scheme-note { display: inline; }",
    ),
  );
});

test("one scheme switch instance shows per side of the breakpoint", () => {
  const css = flatCss(SHELL_CSS);
  assert.ok(
    css.includes(
      ".mbk-screen-head > [data-mokly-schemeswitch] " +
        "{ display: none; margin-left: 0; }",
    ),
  );
  assert.ok(
    css.includes(
      "@media (max-width: 56.25rem) { " +
        ".mbk-topbar > [data-mokly-schemeswitch] { display: none; } " +
        ".mbk-screen-head > [data-mokly-schemeswitch] " +
        "{ display: inline-flex; } }",
    ),
  );
});
