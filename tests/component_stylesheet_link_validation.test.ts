import assert from "node:assert/strict";
import test from "node:test";

import { parseHtmlLinks } from "../dist/html_links.js";
import { extractHtmlReferences } from "../dist/html_references.js";

test("shared discovery keeps active locations, UTF-16 spans and decoded attributes", () => {
  const head = '<link rel="alternate\tStyleSheet" href="a.css?x=1&amp;y=2">';
  const body = '<link rel="stylesheet" href="b.css">';
  const inert = '<link rel="stylesheet" href="inert.css">';
  const html = `<html><head><title>😀</title>${head}<template>${inert}</template><noscript>${inert}</noscript></head><body><!--${inert}--><script>${JSON.stringify(inert)}</script>${body}</body></html>`;
  const { links } = parseHtmlLinks(html);
  assert.deepEqual(
    links.map((link) => [
      link.scope,
      link.stylesheet,
      link.attributes.get("href"),
      html.slice(link.location.startOffset, link.location.endOffset),
    ]),
    [
      ["head", true, "a.css?x=1&y=2", head],
      ["body", true, "b.css", body],
    ],
  );
  assert.deepEqual(extractHtmlReferences(html).resources, [
    "a.css?x=1&y=2",
    "b.css",
  ]);
});
