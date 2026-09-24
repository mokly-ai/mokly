import assert from "node:assert/strict";
import test from "node:test";

import type { Metafile } from "esbuild";

import { stripSourcePathComments } from "../dist/build/styles/outputs.js";
import { scanImportPrelude } from "../dist/build/styles/prelude.js";

test("CSS prelude scans comments, @charset, @layer, escaped strings and qualifiers", () => {
  const css =
    '@charset "UTF-8"; /* skip */ @layer reset; @import url("./tokens.css") layer(theme) supports(display: grid) screen and (min-width: 2px); @import "./spi\\6e ner.css"; .stop{} @import "./late.css";';
  const imports = scanImportPrelude(css);
  assert.deepEqual(
    imports.map((entry) => entry.specifier),
    ["./tokens.css", "./spinner.css"],
  );
  for (const entry of imports)
    assert.ok(css.slice(entry.start, entry.end).startsWith("@import"));
  assert.ok(!imports.some((entry) => entry.specifier.includes("late")));
});

test("unquoted url forms and balanced conditions retain exact removable offsets", () => {
  const css =
    "/*a*/ @import url(./base.css) supports((display: grid) and (color: red)); .app{color:red}";
  const imports = scanImportPrelude(css);
  assert.deepEqual(imports, [
    { start: 6, end: css.indexOf("; .app") + 1, specifier: "./base.css" },
  ]);
  assert.match(
    css.slice(0, imports[0]!.start) + css.slice(imports[0]!.end),
    /\.app\{/,
  );
});

test("a block @layer ends the import prelude", () => {
  assert.deepEqual(
    scanImportPrelude('@layer theme { .a{} } @import "./late.css";'),
    [],
  );
});

test("only esbuild source-path comments are removed, not other CSS content", () => {
  const metafile: Metafile = {
    inputs: {
      "entries/a.css": { bytes: 20, imports: [] },
      "mokly-styles:mokly:styles": { bytes: 9, imports: [] },
    },
    outputs: {},
  };
  const input =
    "/*! keep this license */\n/* entries/a.css */\n.a { color: red; }\n/* mokly-styles:mokly:styles */\n";
  assert.equal(
    stripSourcePathComments(input, metafile),
    "/*! keep this license */\n.a { color: red; }\n",
  );
});
