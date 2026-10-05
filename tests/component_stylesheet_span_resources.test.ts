import assert from "node:assert/strict";
import test from "node:test";

import { insertedStylesheetResources } from "../dist/review/component_stylesheet_resources.js";

const link =
  '<link rel="alternate stylesheet" href="../action%20theme.css?v=1&amp;x=2#theme">';
const route = "screens/checkout.mobile.html";
const html = `<html><head><title>😀</title><!--mokly-review-ignore:start:assets-->${link}<!--mokly-review-ignore:end:assets--></head><body></body></html>`;
const span = (document: string) => ({
  startOffset: document.indexOf(link),
  endOffset: document.indexOf(link) + link.length,
  path: "action theme.css",
  componentIds: ["action"],
});

test("recorded spans identify decoded resources before ignoring author content", () => {
  assert.deepEqual(
    insertedStylesheetResources(
      html,
      { insertedStylesheets: [span(html)] },
      route,
    ),
    ["action theme.css"],
  );
  assert.deepEqual(
    insertedStylesheetResources(html, { insertedStylesheets: [] }, route),
    [],
  );
});

for (const wrapper of ["template", "script", "noscript"])
  test(`a recorded link cannot grant a resource to inactive ${wrapper} content`, () => {
    const document = `<html><head><${wrapper}>${link}</${wrapper}></head><body></body></html>`;
    assert.throws(
      () =>
        insertedStylesheetResources(
          document,
          { insertedStylesheets: [span(document)] },
          route,
        ),
      /invalid inserted stylesheet span/,
    );
  });

for (const invalid of [
  { ...span(html), endOffset: span(html).endOffset - 1 },
  { ...span(html), path: "unlinked.css" },
])
  test(`recorded link rejects mismatched span or path (${invalid.path}, ${invalid.endOffset})`, () => {
    assert.throws(
      () =>
        insertedStylesheetResources(
          html,
          { insertedStylesheets: [invalid] },
          route,
        ),
      /inserted stylesheet span/,
    );
  });
