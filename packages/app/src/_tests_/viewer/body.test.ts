import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ViewerBody } from "../../screens/viewer/body";

const stage = createElement("section", { "data-testid": "stage" }, "Catalogue");

test("the cloud stage uses a div with its main landmark when no overlay is open", () => {
  const html = renderToStaticMarkup(
    createElement(ViewerBody, { beneath: false, heading: "Project", stage }),
  );
  assert.match(html, /<div id="main" role="main" class="fo-viewer-main">/);
  assert.doesNotMatch(html, /<main\b/);
  assert.match(html, /<a class="skip-link" href="#main">Skip to content<\/a>/);
  assert.match(html, /<h1 class="fo-sr-only">Project<\/h1>/);
});

test("an overlay owns the only main while the same stage div stays hidden", () => {
  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(ViewerBody, { beneath: true, heading: "Project", stage }),
      createElement("main", { id: "main" }, createElement("h1", null, "Share")),
    ),
  );
  assert.match(html, /<div class="fo-viewer-backdrop" aria-hidden="true">/);
  assert.equal([...html.matchAll(/<main\b|\brole="main"/g)].length, 1);
  assert.equal([...html.matchAll(/\bid="main"/g)].length, 1);
  assert.match(html, /data-testid="stage"/);
  assert.doesNotMatch(html, /class="skip-link"|class="fo-sr-only"/);
});
