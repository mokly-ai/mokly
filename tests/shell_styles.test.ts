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

test("shell stylesheet stays aligned with the design contract", () => {
  assert.match(STANDALONE_CSS, /--_mokly-private-accent-default: #4f7864/);
  assert.match(STANDALONE_CSS, /--mb-added: var\(--mbk-accent-deep\)/);
  assert.match(STANDALONE_CSS, /--mbk-dark-screen-bg: #121514/);
  assert.match(STANDALONE_CSS, /--mbk-dark-screen-ink: #eef1ef/);
  assert.match(STANDALONE_CSS, /color-scheme: light/);
  assert.match(STANDALONE_CSS, /width: 390px/);
  assert.match(STANDALONE_CSS, /max-width: 1180px/);
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
  assert.match(
    STANDALONE_CSS,
    /\.phone-status \{[\s\S]*flex: 0 0 44px;[\s\S]*padding: 14px 28px 0;/,
  );
  assert.match(
    STANDALONE_CSS,
    /\.phone-screen \{[\s\S]*flex-direction: column;/,
  );
  assert.match(
    STANDALONE_CSS,
    /\.phone-screen \.mbk-frag \{[\s\S]*border-radius: 0 0 36px 36px;/,
  );

  assert.match(STANDALONE_CSS, /prefers-reduced-motion/);
  assert.match(STANDALONE_CSS, /InterVariable\.woff2/);
  assert.match(STANDALONE_CSS, /\.mbk-pathchip \{[\s\S]*cursor: pointer;/);
  assert.match(
    STANDALONE_CSS,
    /\.mbk-pathchip:active \{[\s\S]*transform: translateY\(1px\);/,
  );
});

test("both split dividers share one grip affordance", () => {
  const css = flatCss(STANDALONE_CSS);
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
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS])
    assert.equal(
      flatCss(styles).includes(".mbk-inspector-resize:focus-visible { outline"),
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
    STANDALONE_CSS,
    /@media \(width < 56\.25rem\) \{[\s\S]*\.mbk-inspector\[data-open="true"\] \.mbk-inspector-resize \{[\s\S]*display: none;/,
  );
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
    /\.mbk-search-tag \{[^}]*width: 20px;[^}]*height: 20px;[^}]*cursor: pointer;/,
  );
  assert.ok(
    css.includes(
      ".mbk-search-tag:hover { background: var(--chrome-border); " +
        "color: var(--chrome-ink-2); }",
    ),
  );
  assert.match(
    STANDALONE_CSS,
    /\.mbk-tag-picker \{[^}]*position: absolute;[^}]*top: calc\(100% \+ 7px\);[^}]*border-radius: 10px;[^}]*background: var\(--chrome-surface\);[^}]*box-shadow: var\(--chrome-shadow\);/,
  );
  assert.match(
    STANDALONE_CSS,
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
