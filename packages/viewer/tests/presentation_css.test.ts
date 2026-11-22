import assert from "node:assert/strict";
import { test } from "node:test";

import { rewriteCss } from "../src/previews/presentation_css.js";

const BASE = "https://catalogue.test/archive/docs/index.html";

test("CSS URL tokens resolve relative addresses and decode escapes", () => {
  const css =
    "background: url(one.png), url('two.png'), url(\"three.png\"), " +
    "URL( \t /root.svg \n ), url(//images.test/wide.svg), url(?raw=1), " +
    'url(./\\64 ot.svg), url("soft\\\r\nline.png"), ' +
    'url("inset.png" /* url(ignored.png) */);';
  assert.equal(
    rewriteCss(css, BASE),
    'background: url("https://catalogue.test/archive/docs/one.png"), ' +
      'url("https://catalogue.test/archive/docs/two.png"), ' +
      'url("https://catalogue.test/archive/docs/three.png"), ' +
      'url("https://catalogue.test/root.svg"), url("https://images.test/wide.svg"), ' +
      'url("https://catalogue.test/archive/docs/index.html?raw=1"), ' +
      'url("https://catalogue.test/archive/docs/dot.svg"), ' +
      'url("https://catalogue.test/archive/docs/softline.png"), ' +
      'url("https://catalogue.test/archive/docs/inset.png" /* url(ignored.png) */);',
  );
});

test("CSS imports and image sets rewrite their reference strings", () => {
  const css =
    '@IMPORT /* theme */ "theme.css"; @import url(./print.css) print;\n' +
    'a { background: IMAGE-SET("one.avif" type("image/avif") 1x, url(two.png) 2x); ' +
    "mask: -webkit-image-set('mask.png' 1x); }";
  assert.equal(
    rewriteCss(css, BASE),
    '@IMPORT /* theme */ "https://catalogue.test/archive/docs/theme.css"; ' +
      '@import url("https://catalogue.test/archive/docs/print.css") print;\n' +
      'a { background: IMAGE-SET("https://catalogue.test/archive/docs/one.avif" ' +
      'type("image/avif") 1x, url("https://catalogue.test/archive/docs/two.png") 2x); ' +
      'mask: -webkit-image-set("https://catalogue.test/archive/docs/mask.png" 1x); }',
  );
});

test("CSS scanning preserves comments, ordinary strings and unchanged URL tokens", () => {
  const unchanged =
    '/* url(ignored.png) */\n.a { content: "url(text.png)"; a: myurl(no.png); ' +
    'b: url(), url(" \t "), url( #icon ), url(" #gradient "), ' +
    "URL( 'https://IMAGES.test/a.png' ), url(data:image/png;base64,AAAA), " +
    'url(//[bad-host/), url(bad value), url(bad"quote), ' +
    'url("bad.svg" nested(url(ignored.svg))); content: "bad string\n;';
  assert.equal(
    rewriteCss(unchanged + " background: url(next.png); }", BASE),
    unchanged +
      ' background: url("https://catalogue.test/archive/docs/next.png"); }',
  );
});

test("a Markdown font address resolves to its comparison generation's copy", () => {
  assert.equal(
    rewriteCss(
      '@font-face { src: url("../../../../mokly-viewer/fonts/Geist-Variable.woff2") format("woff2"); }',
      "https://catalogue.test/mokly-viewer/diffs/generations/example/snapshots/before/mokly-generated/notes/retired/index.html",
    ),
    '@font-face { src: url("https://catalogue.test/mokly-viewer/diffs/generations/example/snapshots/mokly-viewer/fonts/Geist-Variable.woff2") format("woff2"); }',
  );
});
