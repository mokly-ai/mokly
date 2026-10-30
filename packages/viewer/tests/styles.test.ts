import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { embeddedStyles } from "../scripts/styles.mjs";
import { shellCss, standaloneShellCss } from "../src/shell/css.js";
import {
  SHELL_THEME_CSS,
  STANDALONE_STUB_THEME_CSS,
} from "../src/shell/css_theme.js";
import { SHELL_TOKENS_CSS } from "../src/shell/css_tokens.js";
import { NARROW_LAYOUT, NARROW_SHELL } from "../src/shell/layout_breakpoint.js";

/** The built stylesheets that a delivery and an embedded host receive. */
const [STANDALONE_CSS, EMBEDDED_CSS] = await Promise.all([
  fs.readFile(new URL("../dist/shell.css", import.meta.url), "utf8"),
  fs.readFile(new URL("../dist/styles.css", import.meta.url), "utf8"),
]);

/** The rules of the installed `@mokly/ui`, which the build bundles. */
const PACKAGE_CSS = await fs.readFile(
  fileURLToPath(import.meta.resolve("@mokly/ui/styles.css")),
  "utf8",
);

const bareDocumentSelector =
  /(?<![-_a-zA-Z0-9])(?:html|body)(?![-_a-zA-Z0-9])|:root(?![-_a-zA-Z0-9])/;

test("embedded styles scope document selectors without corrupting classes", () => {
  const styles = EMBEDDED_CSS;

  assert.doesNotMatch(styles, /-:scope/);
  assert.doesNotMatch(styles, bareDocumentSelector);
  assert.match(styles, /:scope\.mbk\s*\{/);
  assert.match(styles, /\.mbk-body\s*\{/);
  assert.match(styles, /\.mbk-details-body\s*\{/);
});

const stubAuto =
  /@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-mokly-theme\]\)\s*\{[^}]*--chrome-bg: #161512;/;

test("the standalone stylesheet paints the unmarked stub in the system appearance", () => {
  const standalone = standaloneShellCss("");
  assert.match(standalone, stubAuto);
  assert.ok(standalone.startsWith(shellCss("")));
  assert.match(STANDALONE_CSS, stubAuto);
});

test("no embedded or shared rule matches a root without an appearance mark", () => {
  assert.ok(STANDALONE_CSS.endsWith(STANDALONE_STUB_THEME_CSS));
  // Only the standalone stub must match a root without an appearance mark.
  const shared = STANDALONE_CSS.slice(0, -STANDALONE_STUB_THEME_CSS.length);
  assert.doesNotMatch(shared, /:not\(\[data-mokly-theme\]\)/);
  assert.doesNotMatch(EMBEDDED_CSS, /:not\(\[data-mokly-theme\]\)/);
  assert.doesNotMatch(EMBEDDED_CSS, bareDocumentSelector);
});

/** A package component stylesheet: unlayered rules, as `@mokly/ui` ships. */
const COMPONENT_CSS = ".mbk-x { color: red }\n";

test("the package component rules follow the tokens and the palette", () => {
  const base = SHELL_TOKENS_CSS + SHELL_THEME_CSS;
  const shell = shellCss(COMPONENT_CSS);
  const ownRules = shellCss("");
  assert.ok(ownRules.startsWith(base));
  assert.equal(shell, base + COMPONENT_CSS + ownRules.slice(base.length));
  assert.equal(
    standaloneShellCss(COMPONENT_CSS),
    shell + STANDALONE_STUB_THEME_CSS,
  );
});

test("embedded styles keep a package rule whole after the palette", () => {
  const styles = embeddedStyles(shellCss(COMPONENT_CSS));
  const scope = styles.search(
    /@scope \(\.mokly-viewer\) to \(\[data-mokly-slot\]\) \{/,
  );
  const rule = styles.indexOf(".mbk-x {");
  assert.ok(scope >= 0 && scope < rule, "the rule sits inside the scope");
  assert.ok(rule < styles.lastIndexOf("}"), "the scope closes after it");
  const whole = /^\.mbk-x \{[^}]*\}\s*/u.exec(styles.slice(rule))?.[0] ?? "";
  assert.equal(whole.trim().replace(/\s+/g, " "), ".mbk-x { color: red; }");
  // The scoped tokens and palette come before the rule, and without it the
  // stylesheet is the shell's stylesheet without package rules.
  const palette = embeddedStyles(SHELL_TOKENS_CSS + SHELL_THEME_CSS);
  assert.equal(
    styles.slice(0, rule).trimEnd(),
    palette.slice(0, palette.lastIndexOf("}")).trimEnd(),
  );
  assert.equal(
    styles.slice(0, rule) + styles.slice(rule + whole.length),
    embeddedStyles(shellCss("")),
  );
  assert.doesNotMatch(styles, /-:scope/);
  assert.doesNotMatch(styles, bareDocumentSelector);
  // A rule of the shell root class also matches the scope root itself.
  assert.match(
    embeddedStyles(shellCss(".mbk { color: red }\n")),
    /:scope\.mbk\s*\{/,
  );
});

/** The scope that stops at host slots, and the rules after it. */
function scopeParts(styles: string): { inside: string; after: string } {
  const head = "@scope (.mokly-viewer) to ([data-mokly-slot]) {";
  const start = styles.indexOf(head);
  assert.ok(start >= 0, "the stylesheet has the scope");
  let depth = 0;
  for (let index = start + head.length - 1; index < styles.length; index++) {
    if (styles[index] === "{") depth++;
    else if (styles[index] === "}" && --depth === 0)
      return {
        inside: styles.slice(start + head.length, index),
        after: styles.slice(index + 1),
      };
  }
  assert.fail("the scope does not close");
}

/** The position of each text in `styles`, which must hold each of them. */
function positions(styles: string, texts: readonly string[]): number[] {
  return texts.map((text) => {
    const position = styles.indexOf(text);
    assert.ok(position >= 0, `${text} is missing`);
    return position;
  });
}

test("embedded styles keep the root's own rules after the scope, in their order", () => {
  const { inside, after } = scopeParts(
    embeddedStyles(
      shellCss(
        [
          ".mbk-x { color: red }",
          ".mokly-viewer { position: relative }",
          "@media (width < 56.25rem) { .mbk-y { color: red } }",
          "@scope (.mokly-viewer) to ([data-mokly-slot]) { :scope.mbk { height: 100% } }",
          ".mokly-viewer > .mbk-body, .mokly-viewer .mbk-z { display: flex }",
          ".mokly-viewer .mbk-mixed, .mbk-mixed { color: green }",
          ".mokly-viewer-note { color: blue }",
          ".mbk-w .mokly-viewer { color: purple }",
          "@media (width < 56.25rem) { .mokly-viewer .mbk-rail { width: 0 } }",
          "@container mokly-top-host (max-width: 560px) { .mokly-top-host > .mbk-topbar { gap: 8px } }",
          "@container other (max-width: 560px) { .mbk-v { gap: 8px } }",
        ].join("\n"),
      ),
    ),
  );
  // Each root rule follows the scope once, in the order of the source.
  const root = [
    ".mokly-viewer {",
    "@scope (.mokly-viewer) to ([data-mokly-slot])",
    ".mokly-viewer > .mbk-body, .mokly-viewer .mbk-z {",
    "@media (width < 56.25rem) {\n  .mokly-viewer .mbk-rail {",
    "@container mokly-top-host",
  ];
  const order = positions(after, root);
  assert.deepEqual(
    order,
    [...order].sort((first, second) => first - second),
  );
  // No root rule starts a line inside the scope.
  for (const text of root) assert.ok(!inside.includes(`\n${text}`), text);
  // A rule that only names the root class elsewhere stays in the scope.
  positions(inside, [
    ".mbk-x {",
    ".mbk-y {",
    ".mokly-viewer .mbk-mixed, .mbk-mixed {",
    ".mokly-viewer-note {",
    ".mbk-w .mokly-viewer {",
    "@container other",
  ]);
  for (const text of [".mbk-x", ".mbk-mixed", "mokly-viewer-note", "other"])
    assert.ok(!after.includes(text), text);
});

test("the built embedded stylesheet keeps the root's own package rules after its scope", () => {
  const { inside, after } = scopeParts(EMBEDDED_CSS);
  assert.match(after, /^\s*\.mokly-viewer \{/);
  positions(after, [
    "@scope (.mokly-viewer) to ([data-mokly-slot])",
    '.mokly-viewer [data-mokly-slot="stageOverlay"]',
    "@container mokly-top-host",
  ]);
  assert.doesNotMatch(inside, /(^|[{},]\s*)\.mokly-viewer\b/u);
  assert.doesNotMatch(inside, /@container\b/u);
});

test("no shell stylesheet declares a cascade layer", () => {
  // A host reset outside every layer, or in a layer that the host declares
  // later, would beat each layered rule whatever its specificity.
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS])
    assert.doesNotMatch(styles.replace(/\/\*[^]*?\*\//g, ""), /@layer\b/);
});

/**
 * The media queries of the package rules: the shell's layout breakpoint, its
 * device breakpoint, and the reader's reduced motion.
 */
const PACKAGE_QUERIES = new Set<string>([
  NARROW_SHELL,
  NARROW_LAYOUT,
  "(prefers-reduced-motion: reduce)",
]);

test("the package rules switch at the shell's layout and device breakpoints", () => {
  const queries = [...PACKAGE_CSS.matchAll(/@media ([^{]+)\{/g)].map((match) =>
    match[1]!.trim(),
  );
  assert.ok(
    queries.includes(NARROW_SHELL),
    "the package stylesheet has a narrow rule",
  );
  for (const query of queries) assert.ok(PACKAGE_QUERIES.has(query), query);
});
