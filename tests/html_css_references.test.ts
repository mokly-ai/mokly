import assert from "node:assert/strict";
import test from "node:test";

import { extractCssReferences } from "../dist/css_references.js";
import { extractHtmlReferences } from "../dist/html_references.js";

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
] as const)
  test(`CSS references preserve tokenizer boundaries: ${source}`, () => {
    assert.deepEqual(extractCssReferences(source), expected);
    assert.deepEqual(
      extractHtmlReferences(`<style>${source}</style>`).resources,
      expected,
    );
  });
