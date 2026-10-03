import assert from "node:assert/strict";
import test from "node:test";

import { normalizeProviderHtmlAttributes } from "../scripts/preview/html_paths.mjs";

test("preview adapters normalize only shared-helper-approved HTML paths", () => {
  assert.equal(
    normalizeProviderHtmlAttributes(
      '<a href="/view/screens/home.html?fragment=hero"><img src="/static/assets/logo.html#mark"></a>',
    ),
    '<a href="/view/screens/home?fragment=hero"><img src="/static/assets/logo#mark"></a>',
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
