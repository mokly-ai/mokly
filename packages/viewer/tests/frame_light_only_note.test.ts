/**
 * A light-only view under Dark keeps its light frame and names that fallback
 * in its frame label. Screen frames and component canvases both carry the
 * fallback mark, so the stylesheet must reveal the note in both.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { CSS_VIEWS_RESPONSIVE } from "../src/shell/css_views_responsive.js";

test("the stylesheet names a light-only frame's fallback only under Dark", () => {
  const css = CSS_VIEWS_RESPONSIVE.replace(/\s+/gu, " ");
  assert.ok(css.startsWith(".mbk-frame-scheme-note { display: none;"), css);
  const dark = 'body[data-mokly-color-scheme="dark"]';
  for (const frame of [".mbk-frame-wrap", ".mbk-component-canvas"])
    assert.ok(
      css.includes(
        `${dark} ${frame}[data-color-scheme-fallback] .mbk-frame-scheme-note`,
      ),
      frame,
    );
});
