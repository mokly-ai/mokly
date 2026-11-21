import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRootDocumentPaths,
  localDocumentPaths,
} from "./document-paths.mjs";

test("finds root-relative and relative local document references", () => {
  assert.deepEqual(
    localDocumentPaths(`
      <link href="/main.css?revision=1">
      <script src='./bundle.js#entry'></script>
      <img src=/image.png>
      <a href="#section">Section</a>
      <img src="https://cdn.example/image.png">
      <a href="mailto:hello@example.com">Email</a>
    `),
    ["/main.css", "/bundle.js", "/image.png"],
  );
});

test("accepts local references rooted at the public origin", () => {
  assert.deepEqual(
    assertRootDocumentPaths(
      '<link href="/main.css"><script src="/_expo/entry.js"></script>',
    ),
    ["/main.css", "/_expo/entry.js"],
  );
});

test("rejects relative and same-origin absolute references", () => {
  for (const reference of [
    "entry.js",
    "./entry.js",
    "https://mokly-build.invalid/entry.js",
    "//mokly-build.invalid/entry.js",
  ]) {
    assert.throws(
      () => assertRootDocumentPaths(`<script src="${reference}"></script>`),
      /not root-relative/,
      reference,
    );
  }
});
