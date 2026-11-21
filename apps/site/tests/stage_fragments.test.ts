import assert from "node:assert/strict";
import test from "node:test";

import { serializeOuter } from "parse5";

import { rewriteStage } from "../scripts/stage/fragments.js";
import { stylesheetResources } from "../scripts/stage/stylesheets.js";

import { documentStyles } from "./helpers/stage-styles.js";

function rewriteWelcome(
  html: string,
  readStylesheet: (file: string) => string = (file) =>
    assert.fail(`Unexpected stylesheet read: ${file}`),
) {
  return rewriteStage(
    new Map([
      ["welcome.desktop.html", { html, path: "screens/welcome.desktop.html" }],
    ]),
    readStylesheet,
  );
}

test("resources move beside the document and unpublished links are dropped", () => {
  const rewritten = rewriteWelcome(
    `<!doctype html><html lang="en"><head><title>Welcome</title>
      <link rel="stylesheet" href="../styles.css"><script src="/mokly-viewer/client/frame-probe.js"></script></head>
      <body><main id="welcome"><a href="./details.desktop.html#details">Details</a><a href="./welcome.desktop.html">Self</a><a href="https://example.com/">Away</a></main></body></html>`,
    (file) => {
      assert.equal(file, "styles.css");
      return "main { color: red; }";
    },
  );
  const html = rewritten.documents.get("welcome.desktop.html") ?? "";
  assert.match(
    html,
    /<style data-inlined-stylesheet="">main \{ color: red; \}<\/style>/,
  );
  assert.ok(html.includes('src="./mokly-viewer/client/frame-probe.js"'));
  assert.ok(html.includes('href="./welcome.desktop.html"'));
  assert.ok(html.includes('href="https://example.com/"'));
  assert.ok(!html.includes("details.desktop.html"));
  assert.ok(html.includes(">Details</a>"), "the text of a dropped link stays");
  const probe = "mokly-viewer/client/frame-probe.js";
  assert.deepEqual([...rewritten.resources], [[probe, probe]]);
  assert.equal(rewritten.title, "Welcome");
});

test("linked stylesheets inline in place and reference copied resources", () => {
  const stylesheets = new Map([
    [
      "styles/first.css",
      `@import  "more.css" screen;
.card { mask: url( '../art/card.svg#mark' ); }
.card { background-image: image-set("../art/a.svg" 1x, url("../art/b.svg") 2x, "../art/c.avif" type("image/avif")); }
.x { --caption: @import"./theme.css"; }`,
    ],
    [
      "themes/second.css",
      '.label::after { content: "</style> </STYLE>"; }\n.icon { mask: url(#icon); }',
    ],
  ]);
  const rewritten = rewriteWelcome(
    `<head><title>Welcome</title>
      <style>.before{color:red}</style>
      <link rel="stylesheet" href="../themes/second.css" media="print">
      <link rel=" StyleSheet&#9;next " href="../styles/first.css">
      <style>.after{color:blue}</style>
    </head><body><main></main></body>`,
    (file) => {
      const css = stylesheets.get(file);
      assert.ok(css !== undefined, `Unexpected stylesheet read: ${file}`);
      return css;
    },
  );
  const html = rewritten.documents.get("welcome.desktop.html") ?? "";
  const { links, styles } = documentStyles(html);
  assert.deepEqual(
    styles.map((style) => serializeOuter(style)),
    [
      "<style>.before{color:red}</style>",
      String.raw`<style media="print" data-inlined-stylesheet="">.label::after { content: "<\/style> <\/STYLE>"; }
.icon { mask: url(#icon); }</style>`,
      `<style data-inlined-stylesheet="">@import  "./styles/more.css" screen;
.card { mask: url( './art/card.svg#mark' ); }
.card { background-image: image-set("./art/a.svg" 1x, url("./art/b.svg") 2x, "./art/c.avif" type("image/avif")); }
.x { --caption: @import"./theme.css"; }</style>`,
      "<style>.after{color:blue}</style>",
    ],
  );
  assert.deepEqual(links, []);
  assert.deepEqual(
    [...rewritten.resources],
    [
      ["styles/more.css", "styles/more.css"],
      ["art/card.svg", "art/card.svg"],
      ["art/a.svg", "art/a.svg"],
      ["art/b.svg", "art/b.svg"],
      ["art/c.avif", "art/c.avif"],
    ],
  );
});

test("stylesheet resources include imports and nested URLs", () => {
  assert.deepEqual(
    stylesheetResources(
      "styles/product/inventory.css",
      String.raw`@import "account.css";
@import url("records.css");
@import"compact.css";
.card {
  background-image: url(../art/card.svg#mark);
  background-image: image-set("../art/a.svg" 1x, url("../art/b.svg") 2x, "../art/c.avif" type("image/avif"));
  background-image: -webkit-image-set("../art/legacy.svg" 1x);
  --caption: @import"./theme.css";
  --label: @import url("./nested.css");
  --unknown: fake-url(ignored.svg);
  content: "escaped quote: \"; url(ignored.svg)";
}
/* url(comment.svg) @import"comment.css"; */
.label { content: "url(unterminated.svg)`,
    ),
    [
      "styles/product/account.css",
      "styles/product/records.css",
      "styles/product/compact.css",
      "styles/art/card.svg",
      "styles/art/a.svg",
      "styles/art/b.svg",
      "styles/art/c.avif",
      "styles/art/legacy.svg",
    ],
  );
});

test("a resource the stage cannot publish fails the build", () => {
  assert.throws(
    () =>
      rewriteWelcome(
        '<html><head><title>Welcome</title></head><body><main id="welcome"><img srcset="../a.png 1x"></main></body></html>',
      ),
    /responsive source/,
  );
  assert.throws(
    () =>
      rewriteWelcome(
        '<html><head><title>Welcome</title><style>p{background:url(../art.png)}</style></head><body><main id="welcome"></main></body></html>',
      ),
    /embedded stylesheet reference/,
  );
});

test("a document without a titled screen fails the build", () => {
  assert.throws(
    () => rewriteWelcome("<html><body></body></html>"),
    /title and a main landmark/,
  );
});
