import assert from "node:assert/strict";
import test from "node:test";

import { validateExportReferences } from "../dist/export/references.js";

test("export validates self, query-only, cross-document and directory fragment links", () => {
  for (const href of [
    "#missing",
    "?mode=full#missing",
    "other.html#missing",
    "/guide/details#missing",
    "other.html#%ZZ",
  ]) {
    const files = new Map([
      ["index.html", `<a href="${href}">Details</a>`],
      ["other.html", '<h1 id="present">Present</h1>'],
      ["guide/details/index.html", '<h1 id="present">Present</h1>'],
    ]);
    assert.throws(
      () => validateExportReferences(files),
      /anchor|encoding/,
      href,
    );
  }
});

test("valid encoded anchors, hosting aliases, resource fragments and external links remain valid", () => {
  validateExportReferences(
    new Map([
      [
        "index.html",
        '<h1 id="self">Home</h1><a href="#self">Self</a><a href="?mode=full#self">Query</a><a href="/page#present%3Aone">Page</a><a href="/guide/details#present%3Aone">Directory</a><a href="https://example.invalid/#remote">Remote</a><img src="icon.svg#shape">',
      ],
      ["other.html", '<h1 id="present:one">Present</h1>'],
      ["guide/details/index.html", '<h1 id="present:one">Present</h1>'],
      ["icon.svg", '<svg id="shape"></svg>'],
    ]),
    new Map([["page", "other.html"]]),
  );
});

test("comparison snapshot links retain their existing resource-only validation", () => {
  validateExportReferences(
    new Map([
      [
        `__mokly/diffs/__generations/${"a".repeat(64)}/snapshots/before/view.html`,
        '<a href="unpublished.html#missing">Historical link</a>',
      ],
    ]),
  );
});

test("ordinary entry paths containing snapshots retain fragment validation", () => {
  assert.throws(
    () =>
      validateExportReferences(
        new Map([
          [
            "reports/snapshots/daily/index.html",
            '<a href="#missing">Broken</a>',
          ],
        ]),
      ),
    /anchor/,
  );
});
