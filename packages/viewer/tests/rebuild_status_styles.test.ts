import assert from "node:assert/strict";
import { test } from "node:test";

import { embeddedStyles } from "../scripts/styles.mjs";
import { SHELL_CSS } from "../src/shell/css.js";
import { SHELL_REBUILD_STATUS_CSS } from "../src/shell/css_rebuild_status.js";

interface StyleRule {
  body: string;
  media: string | undefined;
  selector: string;
}

/** Top-level and one-level `@media` rules, with comments removed. */
function styleRules(css: string): StyleRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: StyleRule[] = [];
  const collect = (text: string, media: string | undefined) => {
    let index = 0;
    while (index < text.length) {
      const open = text.indexOf("{", index);
      if (open === -1) break;
      const prelude = text.slice(index, open).trim();
      let depth = 1;
      let close = open + 1;
      for (; close < text.length && depth > 0; close += 1) {
        if (text[close] === "{") depth += 1;
        if (text[close] === "}") depth -= 1;
      }
      const body = text.slice(open + 1, close - 1);
      if (prelude.startsWith("@media")) collect(body, prelude);
      else if (!prelude.startsWith("@"))
        found.push({ body: body.trim(), media, selector: prelude });
      index = close;
    }
  };
  collect(source, undefined);
  return found;
}

const rules = styleRules(SHELL_CSS);
const noticeRules = rules.filter((rule) =>
  /mbk-rebuild|mbk-progress|mbk-search-slot/.test(rule.selector),
);

function declarations(selector: string, media?: string): string {
  const rule = rules.find(
    (candidate) => candidate.selector === selector && candidate.media === media,
  );
  assert.ok(rule, `${selector} ${media ?? ""} is styled`);
  return rule.body.replace(/\s+/g, " ");
}

test("the notice draws one tinted card inside a complete outline", () => {
  const card = declarations(".mbk-rebuild-card");
  assert.match(card, /border: 1px solid var\(--mbk-danger-edge\);/);
  assert.match(card, /border-radius: 8px;/);
  assert.match(card, /background: var\(--mbk-danger-bg\);/);
  assert.match(
    declarations(".mbk-rebuild"),
    /border-bottom: 1px solid var\(--chrome-border\);/,
  );
  assert.match(
    declarations(".mbk-rebuild-detail"),
    /max-height: 168px;.*overflow: auto;.*white-space: pre-wrap; overflow-wrap: anywhere;/,
  );
});

test("no notice or progress rule recreates an edge accent", () => {
  assert.ok(noticeRules.length >= 20, `${noticeRules.length} rules audited`);
  for (const { body, selector } of noticeRules) {
    assert.doesNotMatch(selector, /::?(?:before|after)/, selector);
    assert.doesNotMatch(
      body,
      /border-(?:left|right|inline|block)|inset|gradient|box-shadow/,
      selector,
    );
  }
});

test("focus uses the deep accent ring on the control and the detail", () => {
  assert.match(
    declarations(
      ".mbk-rebuild-details > summary:focus-visible,\n.mbk-rebuild-detail:focus-visible",
    ),
    /^outline: 2px solid var\(--mbk-accent-deep\); outline-offset: 2px;$/,
  );
});

test("reduced motion stills the ring and keeps the text and size", () => {
  assert.match(
    declarations(".mbk-progress-spinner"),
    /width: 12px; height: 12px;.*animation: mbk-progress-spin 0\.8s linear infinite;/,
  );
  assert.equal(
    declarations(
      ".mbk-progress-spinner",
      "@media (prefers-reduced-motion: reduce)",
    ),
    "animation: none;",
  );
});

test("compact spacing tightens only the standalone document's bar", () => {
  const compact = "@media (max-width: 56.25rem)";
  assert.equal(
    declarations(".mbk-fs .mbk-topbar", compact),
    "gap: 10px; padding: 0 12px;",
  );
  assert.ok(SHELL_CSS.endsWith(SHELL_REBUILD_STATUS_CSS));
  const embedded = embeddedStyles(SHELL_CSS, "");
  assert.match(embedded, /\.mbk-fs \.mbk-topbar\s*\{/);
  assert.doesNotMatch(embedded, /:scope\s+\.mbk-topbar\s*\{\s*gap:\s*10px/);
});
