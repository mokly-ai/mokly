import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { StageDelivery } from "../src/shell/stage_delivery.js";

test("the stage waits for the routed details with a quiet status", () => {
  const html = renderToStaticMarkup(
    <StageDelivery delivery={{ status: "loading" }} kind="screen" />,
  );
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /<p role="status">Loading preview…<\/p>/);
  assert.doesNotMatch(html, /<iframe/);
});

test("a replaced catalogue keeps the quiet loading status without an action", () => {
  for (const kind of ["screen", "use-case"] as const) {
    const html = renderToStaticMarkup(
      <StageDelivery delivery={{ status: "replaced" }} kind={kind} />,
    );
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /<p role="status">Loading preview…<\/p>/);
    assert.doesNotMatch(html, /role="alert"|could not be shown|<button/);
  }
});

test("a failed detail names the entry and offers one retry", () => {
  const retry = () => undefined;
  for (const [kind, noun] of [
    ["screen", "screen"],
    ["component", "component"],
    ["page", "page"],
    ["document", "document"],
    ["use-case", "user flow"],
  ] as const) {
    const html = renderToStaticMarkup(
      <StageDelivery delivery={{ status: "failed", retry }} kind={kind} />,
    );
    assert.match(html, new RegExp(`<h2>This ${noun} could not be shown</h2>`));
    assert.match(
      html,
      /The catalogue is still available while you try again\./,
    );
    assert.equal(html.match(/<button/g)?.length, 1);
    assert.match(html, />Try again<\/button>/);
  }
});
