import assert from "node:assert/strict";
import test from "node:test";

import { SHELL_CSS } from "../packages/viewer/dist/shell/css.js";

import { flatCss } from "./helpers/shell_css.js";

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
