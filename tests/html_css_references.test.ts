import assert from "node:assert/strict";
import test from "node:test";

import { extractCssReferences } from "../dist/css_references.js";
import {
  extractHtmlReferences,
  resolveLocalReferencePath,
} from "../dist/html_references.js";

for (const [source, expected] of [
  ["color: red; padding: 2px", []],
  ["color: var(--tone); transform: translateX(0px)", []],
  [String.raw`background: u\72l(icon.svg)`, ["icon.svg"]],
  [String.raw`@\69mport "theme.css";`, ["theme.css"]],
  ["a { background: url(a/*/b.svg); }", ["a/*/b.svg"]],
  ['a { background: url("a/*b.svg"); }', ["a/*b.svg"]],
  ['a { background: url("a/*comment*/b.svg"); }', ["a/*comment*/b.svg"]],
  ["a { background: /* asset */url(image.svg); }", ["image.svg"]],
  [
    '@import /* import */ "theme/*night*/tokens.css";',
    ["theme/*night*/tokens.css"],
  ],
  ['a { content: "url(fake.svg)"; background: url/**/("fake.svg"); }', []],
  [
    '@import url("theme.css"); a { background: URL(icon.svg); }',
    ["theme.css", "icon.svg"],
  ],
  ["a { background: url(icon.svg); } /* unclosed", ["icon.svg"]],
  ['a{background:image-set("a.png" 1x, url("b.png") 2x)}', ["a.png", "b.png"]],
] as const)
  test(`CSS references preserve tokenizer boundaries: ${source}`, () => {
    assert.deepEqual(extractCssReferences(source), expected);
    assert.deepEqual(
      extractHtmlReferences(`<style>${source}</style>`).resources,
      expected,
    );
  });

test("local references resolve from the generated document's actual directory", () => {
  assert.deepEqual(
    resolveLocalReferencePath(
      "mokly-generated/home/index.mobile.html",
      "../../styles.css?theme=dark#header",
    ),
    { kind: "resolved", path: "styles.css" },
  );
  assert.deepEqual(
    resolveLocalReferencePath(
      "mokly-generated/home/index.html",
      "../../../secret.css",
    ),
    { kind: "escape" },
  );
  assert.deepEqual(
    resolveLocalReferencePath("mokly-generated/home.html", "%2Fprivate.css"),
    { kind: "root-absolute" },
  );
  assert.deepEqual(resolveLocalReferencePath("index.html", "/", true), {
    kind: "resolved",
    path: "index.html",
  });
  assert.deepEqual(resolveLocalReferencePath("index.html", "%ZZ"), {
    kind: "invalid-encoding",
  });
});
