import assert from "node:assert/strict";
import test from "node:test";

import { currentDocumentRoute } from "../packages/viewer/dist/catalogue/delivery_paths.js";
import {
  normalizedHtmlPath,
  sameFrameResource,
} from "../packages/viewer/dist/client/same_origin_identity.js";

test("static host normalization preserves exact resource identity queries and containing directories", () => {
  for (const [canonical, equivalent] of [
    [
      "/view/team/index.html",
      ["/view/team", "/view/team/", "/view/team/index.html"],
    ],
    [
      "/static/mokly-generated/team/index.desktop.html",
      [
        "/static/mokly-generated/team/index.desktop",
        "/static/mokly-generated/team/index.desktop.html",
      ],
    ],
    [
      "/static/mokly-generated/team/index.html",
      [
        "/static/mokly-generated/team",
        "/static/mokly-generated/team/",
        "/static/mokly-generated/team/index.html",
      ],
    ],
  ] as const) {
    const expected = new URL(
      `${canonical}?variant=one`,
      "https://example.test",
    );
    for (const actual of equivalent) {
      assert.equal(normalizedHtmlPath(actual), normalizedHtmlPath(canonical));
      assert.equal(
        sameFrameResource(
          `https://example.test${actual}?variant=one#anchor`,
          expected,
        ),
        true,
      );
      for (const changed of [
        `https://elsewhere.test${actual}?variant=one`,
        `https://example.test${actual}?variant=two`,
        `https://user:pass@example.test${actual}?variant=one`,
        `https://example.test${actual}/nested?variant=one`,
      ])
        assert.equal(sameFrameResource(changed, expected), false);
    }
  }
  for (const pathname of [
    "/asset.png",
    "/x.HTML",
    "/x.htm",
    "/x.html/child",
    "/myindex.html/child",
    "/x.json",
  ])
    assert.equal(normalizedHtmlPath(pathname), pathname);
});

test("hosted document admission follows current paths and rejects encoded separators", () => {
  for (const pathname of [
    "/view/constructor/home.html",
    "/static/../secret.html",
    "/external/home.html",
    "/static/mokly-generated/a%2fb/index.html",
    "/static/mokly-generated/%2e%2e/secret/index.html",
    "/static/mokly-generated/con/home/index.html",
  ])
    assert.equal(currentDocumentRoute(pathname), undefined);
  assert.equal(
    currentDocumentRoute("/static/mokly-generated/constructor/home/index.html"),
    "constructor/home/index.html",
  );
  assert.equal(
    currentDocumentRoute("/static/mokly-generated/team/index.desktop.html"),
    "team/index.desktop.html",
  );
  assert.equal(
    normalizedHtmlPath("/static/docs/guide/index.html"),
    "/static/docs/guide",
  );
  assert.equal(
    sameFrameResource(
      "https://example.test/static/docs/guide/#intro",
      new URL("https://example.test/static/docs/guide/index.html#intro"),
    ),
    true,
  );
});
