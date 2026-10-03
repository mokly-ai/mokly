import assert from "node:assert/strict";
import test from "node:test";

import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";

import { flatCss } from "./shell_fixture.js";
import { darkTokenSelectors } from "./shell_fixture_2.js";

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

test("tag chips select in the accent and the bar clears the scrim", () => {
  const css = flatCss(SHELL_CSS);
  assert.match(
    SHELL_CSS,
    /\.mbk-chip\.tag:is\(a, button\) \{[^}]*font: inherit;[^}]*cursor: pointer;/,
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag svg { flex-shrink: 0; color: var(--chrome-muted); }",
    ),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag:is(a, button):hover { background: var(--mokly-accent-soft); }",
    ),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag:is(a, button).active { background: var(--mokly-accent); " +
        "border-color: var(--mokly-accent); " +
        "color: var(--mokly-accent-contrast); }",
    ),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag:is(a, button).active svg { color: var(--mokly-accent-contrast); }",
    ),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag:is(a, button):active { " +
        "box-shadow: var(--chrome-shadow-press); transform: translateY(1px); }",
    ),
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-topbar \{[^}]*position: relative;[^}]*z-index: 11;/,
  );
  assert.match(SHELL_CSS, /\.mbk-skip-link \{[^}]*z-index: 20;/);
  assert.match(SHELL_CSS, /\.mbk-nav \{[^}]*z-index: 10;/);
});

test("the tag picker drops from the field and sheets under the bar", () => {
  const css = flatCss(SHELL_CSS);
  assert.match(SHELL_CSS, /\.mbk-search \{[^}]*position: relative;/);
  assert.match(
    SHELL_CSS,
    /\.mbk-search-tag \{[^}]*width: 20px;[^}]*height: 20px;[^}]*cursor: pointer;/,
  );
  assert.ok(
    css.includes(
      ".mbk-search-tag:hover { background: var(--chrome-border); " +
        "color: var(--chrome-ink-2); }",
    ),
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-tag-picker \{[^}]*position: absolute;[^}]*top: calc\(100% \+ 7px\);[^}]*border-radius: 10px;[^}]*background: var\(--chrome-surface\);[^}]*box-shadow: var\(--chrome-shadow\);/,
  );
  assert.match(
    SHELL_CSS,
    /\.mbk-tag-picker-head \{[^}]*font-size: 11px;[^}]*text-transform: uppercase;/,
  );
  assert.ok(
    css.includes(
      ".mbk-tag-picker .mbk-chips { max-height: 210px; " +
        "overflow-y: auto; }",
    ),
  );
  assert.ok(css.includes(".mbk-search { position: static; }"));
  assert.ok(
    css.includes(
      ".mbk-tag-picker { top: calc(100% + 1px); right: 0; left: 0; " +
        "border-top: 0; border-radius: 0 0 12px 12px; }",
    ),
  );
});

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

  const selectors = darkTokenSelectors(SHELL_CSS).map(flatCss);
  assert.equal(selectors.length, 7);
  for (const selector of selectors)
    assert.ok(selector.startsWith(scope), selector);
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
