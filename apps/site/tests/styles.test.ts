import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { responsiveTokenCss } from "@mokly-cloud/tokens/token-css";
import { tokens } from "@mokly-cloud/tokens/tokens";

import { GET as favicon } from "../src/pages/favicon.svg.js";
import { SITE_TOKEN_CSS } from "../src/styles/token-styles.js";

const styles = path.resolve(import.meta.dirname, "..", "src", "styles");

const NAMED_COLORS =
  /(?<![\w-])(?:aqua|black|blue|brown|fuchsia|gold|gray|green|grey|lime|maroon|navy|olive|orange|pink|purple|red|silver|teal|violet|white|yellow)(?![\w-])/i;

/** A role, as a site sheet names one. */
const ROLE = String.raw`var\(--mk-[\w-]+\)`;

/**
 * The one tint that docs/protocol/cloud/site-design.md allows: a role or the
 * current colour, mixed in sRGB with another role or with transparent.
 */
const TINT = new RegExp(
  String.raw`^color-mix\(in srgb, (?:${ROLE}|currentColor) \d+(?:\.\d+)?%, (?:${ROLE}|transparent)\)$`,
);

/** Every `color-mix()` call in a sheet, on one line, as Prettier spaces it. */
function mixes(source: string): string[] {
  const found: string[] = [];
  for (const { index } of source.matchAll(/color-mix\(/g)) {
    let depth = 0;
    for (let end = index; end < source.length; end++) {
      if (source[end] === "(") depth++;
      if (source[end] === ")" && --depth === 0) {
        found.push(
          source
            .slice(index, end + 1)
            .replace(/\s+/g, " ")
            .replace(/\( | \)/g, (space) => space.trim()),
        );
        break;
      }
    }
  }
  return found;
}

/**
 * The composition switches: the 768px breakpoint every page shares, and the
 * width at which the documentation hangs its on-this-page rail, both fixed by
 * docs/protocol/cloud/site-design.md.
 */
const WIDTH_QUERIES = ["min-width: 768px", "min-width: 1100px"];

/**
 * Controls whose whole boundary must be meaningful rather than decorative.
 * Any rule that reserves the minimum target size is treated as a control too,
 * so a new control cannot take the hairline by staying off this list.
 */
const CONTROLS = [
  ".site-button",
  ".site-code-copy",
  ".site-doc-disclosure",
  ".site-pager-item",
  ".site-search",
  ".site-search-input",
  ".site-skip",
  ".site-version",
];

const REQUIRED_TOKENS = [
  "--mk-color-background",
  "--mk-color-surface",
  "--mk-color-surface-muted",
  "--mk-color-text",
  "--mk-color-text-muted",
  "--mk-color-border",
  "--mk-color-border-strong",
  "--mk-color-accent",
  "--mk-color-accent-hover",
  "--mk-color-accent-active",
  "--mk-color-accent-solid",
  "--mk-color-on-accent",
  "--mk-color-accent-soft",
  "--mk-color-focus",
  "--mk-color-success",
  "--mk-color-success-soft",
  "--mk-color-warning",
  "--mk-color-warning-soft",
  "--mk-color-danger",
  "--mk-color-danger-soft",
  "--mk-color-info",
  "--mk-color-info-soft",
];

async function stylesheets(): Promise<string[]> {
  const entries = await readdir(styles);
  return entries.filter((name) => name.endsWith(".css")).sort();
}

/** Every rule in the site's own sheets, as a selector and its declarations. */
async function siteRules(): Promise<
  Array<{ name: string; selector: string; declarations: string[] }>
> {
  const rules: Array<{
    name: string;
    selector: string;
    declarations: string[];
  }> = [];
  for (const name of await stylesheets()) {
    const source = (await readFile(path.join(styles, name), "utf8")).replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if ((selector ?? "").trim().startsWith("@")) continue;
      rules.push({
        declarations: (body ?? "")
          .split(";")
          .map((line) => line.trim().replace(/\s+/g, " "))
          .filter((line) => line.length > 0),
        name,
        selector: (selector ?? "").trim().replace(/\s+/g, " "),
      });
    }
  }
  return rules;
}

test("site styles consume workspace tokens without declaring another palette", async () => {
  const sheets = await stylesheets();
  assert.ok(!sheets.includes("tokens.css"));
  assert.ok(sheets.length > 1, "the site has component stylesheets");
  for (const name of sheets) {
    const source = await readFile(path.join(styles, name), "utf8");
    assert.doesNotMatch(source, /--site-/, name);
    assert.doesNotMatch(source, /--mk-[\w-]+\s*:/, name);
    for (const mix of mixes(source)) assert.match(mix, TINT, `${name}: ${mix}`);
    assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/, name);
    assert.doesNotMatch(source, /\b(?:rgba?|hsla?|oklch)\(/, name);
    for (const [, value] of source.matchAll(/^\s*[\w-]+:\s*([^;]+);/gm)) {
      const literal = (value ?? "")
        .replace(/(?<![\w-])(?:transparent|currentColor)(?![\w-])/gi, "")
        .replace(/var\([^)]*\)/g, "");
      assert.doesNotMatch(literal, NAMED_COLORS, `${name}: ${value ?? ""}`);
    }
  }
});

test("the generated site theme is the complete responsive workspace output", async () => {
  const preferred = responsiveTokenCss(
    "dark",
    ':root:not([data-color-scheme="light"])',
  );
  assert.equal(
    SITE_TOKEN_CSS,
    [
      responsiveTokenCss("light", ":root"),
      responsiveTokenCss("dark", ':root[data-color-scheme="dark"]'),
      `@media (prefers-color-scheme: dark){${preferred}}`,
    ].join(""),
  );
  const used = new Set<string>();
  for (const name of await stylesheets()) {
    const source = await readFile(path.join(styles, name), "utf8");
    for (const match of source.matchAll(/var\((--mk-[\w-]+)/g))
      used.add(match[1] ?? "");
  }
  assert.ok(used.size > 40, "the test still covers the site token surface");
  for (const scheme of ["light", "dark"] as const) {
    const emitted = responsiveTokenCss(scheme, ":root");
    for (const property of used)
      assert.ok(emitted.includes(`${property}:`), `${scheme}: ${property}`);
  }
});

test("the generated favicon draws the mark from workspace colors", async () => {
  const response = favicon();
  assert.match(response.headers.get("content-type") ?? "", /image\/svg\+xml/);
  const source = await response.text();
  for (const value of [
    tokens.color.light.text,
    tokens.color.light.signal,
    tokens.color.light.onSignal,
    tokens.color.dark.text,
    tokens.color.dark.signal,
    tokens.color.dark.onSignal,
  ])
    assert.ok(source.includes(value), value);
  for (const role of ["text", "signal", "on-signal"])
    assert.match(source, new RegExp(`var\\(--${role}\\)`), role);
  assert.match(source, /@media\(prefers-color-scheme:dark\)/);
});

test("the desktop composition resolves at the 768px breakpoint", async () => {
  assert.equal(tokens.layout.breakpoint, "768px");
  for (const name of await stylesheets()) {
    const sheet = await readFile(path.join(styles, name), "utf8");
    for (const [, query] of sheet.matchAll(/@media \(([^)]*width[^)]*)\)/g)) {
      assert.ok(WIDTH_QUERIES.includes(query ?? ""), `${name}: ${query ?? ""}`);
    }
  }
});

test("the build inlines the generated workspace theme", async () => {
  const html = await readFile(
    path.resolve(import.meta.dirname, "..", "dist", "index.html"),
    "utf8",
  );
  assert.ok(!html.includes("@import"), "a token import reached the browser");
  for (const token of REQUIRED_TOKENS) {
    assert.ok(
      html.includes(`${token}:`),
      `the built stylesheet is missing ${token}`,
    );
  }
  assert.match(html, /@media\s*\(prefers-color-scheme:\s*dark\)/);
});

test("no stylesheet removes a focus outline", async () => {
  for (const name of await stylesheets()) {
    const sheet = await readFile(path.join(styles, name), "utf8");
    assert.doesNotMatch(sheet, /outline\s*:\s*(?:none|0)\b/, name);
  }
});

test("a control's whole boundary is meaningful, never the hairline", async () => {
  const rules = await siteRules();
  const controls = rules.filter(
    (rule) =>
      rule.declarations.includes("min-height: var(--mk-layout-control-min)") ||
      rule.selector
        .split(",")
        .some((part) =>
          CONTROLS.some((control) =>
            new RegExp(`${control}(?:--[\\w-]+)?(?:[:\\s>]|$)`).test(
              part.trim(),
            ),
          ),
        ),
  );
  assert.ok(controls.length >= CONTROLS.length, "no control rule was read");
  for (const control of CONTROLS) {
    assert.ok(
      controls.some((rule) => rule.selector.includes(control)),
      `${control} declares no rule`,
    );
  }
  for (const rule of controls) {
    for (const declaration of rule.declarations) {
      if (!/^border(?:-color)?:/.test(declaration)) continue;
      if (!declaration.includes("--mk-color-border")) continue;
      assert.match(
        declaration,
        /--mk-color-border-strong/,
        `${rule.name}: ${rule.selector} { ${declaration} }`,
      );
    }
  }
});
