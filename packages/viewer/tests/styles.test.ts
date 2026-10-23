import assert from "node:assert/strict";
import { test } from "node:test";

import { embeddedStyles } from "../scripts/styles.mjs";
import { SHELL_CSS, STANDALONE_SHELL_CSS } from "../src/shell/css.js";

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
  assert.match(STANDALONE_SHELL_CSS, stubAuto);
  assert.ok(STANDALONE_SHELL_CSS.startsWith(SHELL_CSS));
});

test("no embedded or shared rule matches a root without an appearance mark", () => {
  assert.doesNotMatch(SHELL_CSS, /:not\(\[data-mokly-theme\]\)/);
  const embedded = embeddedStyles(SHELL_CSS, "");
  assert.doesNotMatch(embedded, /:not\(\[data-mokly-theme\]\)/);
  assert.doesNotMatch(embedded, bareDocumentSelector);
});
