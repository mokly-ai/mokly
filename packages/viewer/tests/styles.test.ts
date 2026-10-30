import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { embeddedStyles, standaloneStyles } from "../scripts/styles.mjs";
import { NARROW_LAYOUT, NARROW_SHELL } from "../src/shell/layout_breakpoint.js";

import {
  pageRuleFailures,
  printedStyles,
  printSelector,
  styleRules,
} from "./style_rules.js";

/** The built stylesheets that a delivery and an embedded host receive. */
const [STANDALONE_CSS, EMBEDDED_CSS, FONT_CSS] = await Promise.all([
  fs.readFile(new URL("../dist/shell.css", import.meta.url), "utf8"),
  fs.readFile(new URL("../dist/styles.css", import.meta.url), "utf8"),
  fs.readFile(
    new URL("../src/shell/assets/fonts/inter.css", import.meta.url),
    "utf8",
  ),
]);

/** The rules of the installed `@mokly/ui`, which the build bundles. */
const PACKAGE_CSS = await fs.readFile(
  fileURLToPath(import.meta.resolve("@mokly/ui/styles.css")),
  "utf8",
);

/** The built `@font-face` rule at the start of a stylesheet. */
function fontRule(styles: string): string {
  return /^@font-face \{[^}]*\}/u.exec(styles)?.[0] ?? "";
}

const bareDocumentSelector =
  /(?<![-_a-zA-Z0-9])(?:html|body)(?![-_a-zA-Z0-9])|:root(?![-_a-zA-Z0-9])/;

test("the standalone stylesheet is the shell font at its path, then the package rules", () => {
  assert.equal(STANDALONE_CSS, standaloneStyles(FONT_CSS, PACKAGE_CSS));
  assert.match(
    fontRule(STANDALONE_CSS),
    /font-family: "Inter";[^}]*src: url\("\/mokly-viewer\/fonts\/InterVariable\.woff2"\)/u,
  );
  const sample = ".mbk-x { color: red }\n";
  assert.equal(
    standaloneStyles(FONT_CSS, sample),
    `${fontRule(STANDALONE_CSS)}\n${sample}`,
  );
});

test("the embedded stylesheet names its own font and has no scope", () => {
  assert.match(
    fontRule(EMBEDDED_CSS),
    /font-family: "Mokly Inter";[^}]*src: url\("\.\/assets\/fonts\/InterVariable\.woff2"\)/u,
  );
  assert.doesNotMatch(EMBEDDED_CSS, /"Inter"/u);
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS]) {
    assert.doesNotMatch(styles, /@scope\b|:scope\b/u);
    assert.doesNotMatch(styles, /-:scope/);
    assert.match(styles, /\.mbk-body\s*\{/);
    assert.match(styles, /\.mbk-details-body\s*\{/);
  }
  // The shell root class itself holds a rule, which reaches every root.
  assert.match(EMBEDDED_CSS, /\n\.mbk \{/u);
});

const stubAuto =
  /@media \(prefers-color-scheme: dark\)\s*\{[^{]*\.mbk-document:not\(\[data-mokly-theme\]\)[^{]*\{[^}]*--chrome-bg: #161512;/;

test("the stub's document takes the system appearance until the bundle marks it", () => {
  assert.match(STANDALONE_CSS, stubAuto);
  assert.match(EMBEDDED_CSS, stubAuto);
});

test("no rule but the stub document's matches a root without an appearance mark", () => {
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS]) {
    const unmarked = styleRules(styles)
      .selectors.map(printSelector)
      .filter((selector) => selector.includes(":not([data-mokly-theme])"));
    assert.deepEqual(unmarked, [".mbk-document:not([data-mokly-theme])"]);
  }
});

test("no package rule selects the page, an element outside a component, or a scope", () => {
  assert.deepEqual(pageRuleFailures(PACKAGE_CSS), []);
  assert.deepEqual(pageRuleFailures(EMBEDDED_CSS), []);
  // Only the stub page rules name the page, through the document class.
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS])
    for (const selector of styleRules(styles).selectors.map(printSelector))
      if (bareDocumentSelector.test(selector))
        assert.match(selector, /^\.mbk-document > body$/u, selector);
  // The check catches each form that reaches a host page or its content.
  for (const css of [
    ":root { color: red }",
    "html, .mbk-x { color: red }",
    "body.mbk-nav-resizing { color: red }",
    ".mbk-x:scope { color: red }",
    "a { color: inherit }",
    "* { box-sizing: border-box }",
    ".address { color: red }",
    "[data-mokly-slot] > * { color: red }",
    "@scope (.mokly-viewer) to ([data-mokly-slot]) { .mbk-x { color: red } }",
  ])
    assert.equal(pageRuleFailures(css).length, 1, css);
  assert.deepEqual(
    pageRuleFailures(
      ".mbk-reset:where(a) { color: inherit }\n.address:where(.mbk-reset) { color: red }\n.mbk-document > body { margin: 0 }",
    ),
    [],
  );
});

test("the built embedded stylesheet holds every package rule in its order", () => {
  assert.equal(EMBEDDED_CSS, embeddedStyles(FONT_CSS, PACKAGE_CSS));
  const embedded = styleRules(EMBEDDED_CSS);
  const source = styleRules(printedStyles(PACKAGE_CSS));
  assert.ok(source.selectors.length > 500, "the package has few rules");
  assert.deepEqual(
    embedded.selectors.map(printSelector),
    source.selectors.map(printSelector),
  );
  assert.deepEqual(embedded.atRules, ["font-face", ...source.atRules]);
});

test("embedded styles keep each package rule whole and in its order", () => {
  const sample = [
    ".mbk-x { color: red }",
    ".mokly-viewer { position: relative }",
    "@media (width < 56.25rem) { .mbk-y { color: red } }",
    ".mbk.mokly-viewer { height: 100% }",
    ".mokly-viewer > .mbk-body, .mokly-viewer .mbk-z { display: flex }",
    ".mokly-viewer-note { color: blue }",
    "@media (width < 56.25rem) { .mokly-viewer .mbk-rail { width: 0 } }",
    "@container mokly-top-host (max-width: 560px) { .mokly-top-host > .mbk-topbar { gap: 8px } }",
    "@container other (max-width: 560px) { .mbk-v { gap: 8px } }",
  ];
  const styles = embeddedStyles(FONT_CSS, sample.join("\n"));
  assert.ok(styles.startsWith(`${fontRule(EMBEDDED_CSS)}\n`));
  const rule = styles.indexOf(".mbk-x {");
  const whole = /^\.mbk-x \{[^}]*\}/u.exec(styles.slice(rule))?.[0] ?? "";
  assert.equal(whole.replace(/\s+/g, " "), ".mbk-x { color: red; }");
  const order = [
    ".mbk-x {",
    ".mokly-viewer {",
    ".mbk-y {",
    ".mbk.mokly-viewer {",
    ".mokly-viewer > .mbk-body, .mokly-viewer .mbk-z {",
    ".mokly-viewer-note {",
    ".mokly-viewer .mbk-rail {",
    "@container mokly-top-host",
    "@container other",
  ].map((text) => {
    const position = styles.indexOf(text);
    assert.ok(position >= 0, `${text} is missing`);
    return position;
  });
  assert.deepEqual(
    order,
    [...order].sort((first, second) => first - second),
  );
  assert.doesNotMatch(styles, /@scope\b/u);
});

test("no shell stylesheet declares a cascade layer", () => {
  // A host reset outside every layer, or in a layer that the host declares
  // later, would beat each layered rule whatever its specificity.
  for (const styles of [STANDALONE_CSS, EMBEDDED_CSS])
    assert.doesNotMatch(styles.replace(/\/\*[^]*?\*\//g, ""), /@layer\b/);
});

/**
 * The media queries of the package rules: the shell's layout breakpoint, its
 * device breakpoint, the reader's reduced motion, and the system appearance
 * of Auto.
 */
const PACKAGE_QUERIES = new Set<string>([
  NARROW_SHELL,
  NARROW_LAYOUT,
  "(prefers-reduced-motion: reduce)",
  "(prefers-color-scheme: dark)",
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
