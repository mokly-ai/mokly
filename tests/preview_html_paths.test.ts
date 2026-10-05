import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProviderHtmlAttributes } from "../scripts/preview/html_paths.mjs";

test("preview adapters normalize only shared-helper-approved HTML paths", () => {
  assert.equal(
    normalizeProviderHtmlAttributes(
      '<a href="/view/home/?fragment=hero"><img src="/static/assets/logo.html#mark"></a>',
    ),
    '<a href="/view/home/?fragment=hero"><img src="/static/assets/logo#mark"></a>',
  );
  for (const value of [
    "/view/constructor/home.html",
    "/static/../secret.html",
    "/external/home.html",
  ])
    assert.equal(
      normalizeProviderHtmlAttributes(`<a href="${value}">Open</a>`),
      `<a href="${value}">Open</a>`,
    );
});

test("preview adapters use containing directories for static index documents", () => {
  assert.equal(
    normalizeProviderHtmlAttributes(
      '<iframe src="/static/docs/guide/index.html#intro"></iframe>',
    ),
    '<iframe src="/static/docs/guide/#intro"></iframe>',
  );
});
