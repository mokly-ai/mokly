import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizedHtmlPath,
  sameFrameResource,
} from "../packages/frame/dist/adapters/same_origin_identity.js";

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
