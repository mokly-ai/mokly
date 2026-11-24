import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { flatCss } from "./helpers/shell_assertions.js";

/** The built stylesheets that a delivery and an embedded host receive. */
const [STANDALONE_CSS, EMBEDDED_CSS] = await Promise.all([
  fs.readFile(
    new URL("../packages/viewer/dist/shell.css", import.meta.url),
    "utf8",
  ),
  fs.readFile(
    new URL("../packages/viewer/dist/styles.css", import.meta.url),
    "utf8",
  ),
]);

/** Each public accent override as a rule reads it, with its theme default. */
const ACCENT = "var(--mokly-accent, var(--_mokly-private-accent-default))";
const ACCENT_CONTRAST =
  "var(--mokly-accent-contrast, var(--_mokly-private-accent-contrast-default))";
const ACCENT_SOFT =
  "var(--mokly-accent-soft, var(--_mokly-private-accent-soft-default))";

test("shell stylesheet stays aligned with the design contract", () => {
  assert.match(STANDALONE_CSS, /--_mokly-private-accent-default: #067a45/);
  assert.match(STANDALONE_CSS, /--mb-added: var\(--mbk-accent-deep\)/);
  assert.match(STANDALONE_CSS, /--mbk-dark-screen-bg: #121514/);
  assert.match(STANDALONE_CSS, /--mbk-dark-screen-ink: #eef1ef/);
  assert.match(STANDALONE_CSS, /color-scheme: light/);
  assert.match(STANDALONE_CSS, /@media \(width < 56\.25rem\)/);
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS])
    assert.doesNotMatch(styles, /max-width: 56\.25rem/);
  assert.match(STANDALONE_CSS, /width: var\(--mbk-nav-width, 248px\)/);
  assert.match(
    STANDALONE_CSS,
    /\.mbk-nav-section-head \{[^}]*text-transform: uppercase;[^}]*cursor: pointer;/,
  );
  assert.match(
    STANDALONE_CSS,
    /\.mbk-nav-section\[open\][^{]*\.mbk-nav-section-chevron \{[^}]*transform: rotate\(90deg\);/,
  );
  assert.match(
    STANDALONE_CSS,
    /\.mbk-nav\[data-resize-ready\] \.mbk-nav-resize \{[\s\S]*display: block;/,
  );
  assert.match(
    STANDALONE_CSS,
    /@media \(width < 56\.25rem\) \{[\s\S]*\.mbk-nav-resize \{[\s\S]*display: none;/,
  );

  assert.match(STANDALONE_CSS, /prefers-reduced-motion/);
  assert.match(STANDALONE_CSS, /Geist-Variable\.woff2/);
  assert.match(STANDALONE_CSS, /GeistMono-Variable\.woff2/);
});

test("the navigation divider keeps its grip shape and palette colour, and each drag mark keeps the drag's pointer look", () => {
  const css = flatCss(STANDALONE_CSS);
  const grip =
    '.mbk-nav-resize::after { content: ""; position: absolute; ' +
    "top: calc(50% - 16px); left: 3px; width: 2px; height: 32px; " +
    "border-radius: 999px; background: var(--chrome-border-strong); " +
    "transition: background 120ms ease, box-shadow 120ms ease; }";
  assert.ok(css.includes(grip), grip);
  for (const state of [
    ".mbk-nav-resize:hover::after,",
    ".mbk-nav-resize:focus-visible::after,",
    ".mbk.mbk-nav-resizing .mbk-nav-resize::after " +
      `{ background: ${ACCENT}; ` +
      `box-shadow: 0 0 0 3px ${ACCENT_SOFT}; }`,
  ])
    assert.ok(css.includes(state), state);
  for (const axis of ["col", "row"]) {
    const scope = axis === "col" ? "nav" : "inspector";
    assert.ok(
      css.includes(
        `.mbk.mbk-${scope}-resizing .mbk-reset ` +
          `{ cursor: ${axis}-resize !important; }`,
      ),
      scope,
    );
    assert.ok(
      css.includes(
        `.mbk.mbk-${scope}-resizing iframe.mbk-reset ` +
          "{ pointer-events: none; }",
      ),
      scope,
    );
  }
});

test("tag chips select in the accent and the bar clears the scrim", () => {
  const css = flatCss(STANDALONE_CSS);
  assert.match(
    STANDALONE_CSS,
    /\.mbk-chip\.tag:is\(a, button\) \{[^}]*font: inherit;[^}]*cursor: pointer;/,
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag svg { flex-shrink: 0; color: var(--chrome-muted); }",
    ),
  );
  assert.ok(
    css.includes(
      `.mbk-chip.tag:is(a, button):not(.active):hover { background: ${ACCENT_SOFT}; }`,
    ),
  );
  assert.ok(
    css.includes(
      `.mbk-chip.tag.active { background: ${ACCENT}; ` +
        `border-color: ${ACCENT}; ` +
        `color: ${ACCENT_CONTRAST}; }`,
    ),
  );
  assert.ok(
    css.includes(`.mbk-chip.tag.active svg { color: ${ACCENT_CONTRAST}; }`),
  );
  assert.ok(
    css.includes(
      ".mbk-chip.tag:is(a, button):active { " +
        "box-shadow: var(--chrome-shadow-press); transform: translateY(1px); }",
    ),
  );
  assert.match(
    STANDALONE_CSS,
    /\.mbk-topbar \{[^}]*position: relative;[^}]*z-index: 11;/,
  );
  assert.match(STANDALONE_CSS, /\.mbk-skip-link \{[^}]*z-index: 20;/);
  assert.match(STANDALONE_CSS, /\.mbk-nav \{[^}]*z-index: 10;/);
});

test("the tag picker drops from the field and sheets under the bar", () => {
  const css = flatCss(STANDALONE_CSS);
  assert.match(STANDALONE_CSS, /\.mbk-search \{[^}]*position: relative;/);
  assert.match(
    STANDALONE_CSS,
    /\.mbk-search-tag \{[^}]*width: 20px;[^}]*height: 20px;/,
  );
  assert.ok(css.includes(".mbk-search-tag:is(a, button) { cursor: pointer; }"));
  assert.ok(
    css.includes(
      ".mbk-search-tag:is(a, button):hover { background: var(--chrome-border); " +
        "color: var(--chrome-ink-2); }",
    ),
  );
  assert.match(
    STANDALONE_CSS,
    /\.mbk-tag-picker \{[^}]*position: absolute;[^}]*top: calc\(100% \+ 7px\);[^}]*border-radius: 10px;[^}]*background: var\(--chrome-surface\);[^}]*box-shadow: var\(--chrome-shadow\);/,
  );
  // The picker keeps the field's end edge and its width, between 280px and
  // 440px, so a picker wider than the field grows toward the bar's start.
  assert.ok(
    css.includes(
      "right: -1px; left: auto; width: calc(100% + 2px); " +
        "min-width: 280px; max-width: 440px;",
    ),
  );
  assert.match(
    STANDALONE_CSS,
    /\.mbk-tag-picker-head \{[^}]*font-size: 11px;[^}]*text-transform: uppercase;/,
  );
  // The chip row scrolls, and its padding holds the focus glow of an edge
  // chip, while its margin keeps the chips in place.
  assert.ok(
    css.includes(
      ".mbk-tag-picker .mbk-chips { max-height: 218px; margin: -4px; " +
        "padding: 4px; scroll-padding: 4px; overflow-y: auto; }",
    ),
  );
  assert.ok(css.includes(".mbk-search { position: static; }"));
  assert.ok(
    css.includes(
      ".mbk-tag-picker { top: calc(100% + 1px); right: 0; left: 0; " +
        "width: auto; min-width: 0; max-width: none; " +
        "border-top: 0; border-radius: 0 0 12px 12px; }",
    ),
  );
});
