import assert from "node:assert/strict";
import { test } from "node:test";

import { embeddedStyles } from "../scripts/styles.mjs";
import { SHELL_CSS, shellCss, standaloneShellCss } from "../src/shell/css.js";
import {
  SHELL_THEME_CSS,
  STANDALONE_STUB_THEME_CSS,
} from "../src/shell/css_theme.js";
import { SHELL_TOKENS_CSS } from "../src/shell/css_tokens.js";

const bareDocumentSelector =
  /(?<![-_a-zA-Z0-9])(?:html|body)(?![-_a-zA-Z0-9])|:root(?![-_a-zA-Z0-9])/;

test("embedded styles scope document selectors without corrupting classes", () => {
  const styles = embeddedStyles(SHELL_CSS, "");

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
  assert.ok(standalone.startsWith(SHELL_CSS));
});

test("no embedded or shared rule matches a root without an appearance mark", () => {
  assert.doesNotMatch(SHELL_CSS, /:not\(\[data-mokly-theme\]\)/);
  const embedded = embeddedStyles(SHELL_CSS, "");
  assert.doesNotMatch(embedded, /:not\(\[data-mokly-theme\]\)/);
  assert.doesNotMatch(embedded, bareDocumentSelector);
});

/** A package component stylesheet, in the cascade layer of `@mokly/ui`. */
const COMPONENT_CSS = "@layer mokly.components {\n  .mbk-x { color: red }\n}\n";

test("the package component rules follow the tokens and the palette", () => {
  const base = SHELL_TOKENS_CSS + SHELL_THEME_CSS;
  const shell = shellCss(COMPONENT_CSS);
  assert.ok(SHELL_CSS.startsWith(base));
  assert.equal(shell, base + COMPONENT_CSS + SHELL_CSS.slice(base.length));
  assert.equal(
    standaloneShellCss(COMPONENT_CSS),
    shell + STANDALONE_STUB_THEME_CSS,
  );
});

test("embedded styles keep a package layer block whole inside the scope", () => {
  const styles = embeddedStyles(shellCss(COMPONENT_CSS), "");
  const scope = styles.search(
    /@scope \(\.mokly-viewer\) to \(\[data-mokly-slot\]\) \{/,
  );
  const layer = styles.indexOf("@layer mokly.components {");
  assert.ok(scope >= 0 && scope < layer, "the layer sits inside the scope");
  assert.ok(layer < styles.lastIndexOf("}"), "the scope closes after it");
  assert.match(
    styles.slice(layer).replace(/\s+/g, " "),
    /^@layer mokly\.components \{ \.mbk-x \{ color: red; \} \}/,
  );
  assert.doesNotMatch(styles, /-:scope/);
  assert.doesNotMatch(styles, bareDocumentSelector);
  assert.match(styles, /:scope\.mbk\s*\{/);
});
