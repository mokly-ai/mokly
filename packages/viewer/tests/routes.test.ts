import assert from "node:assert/strict";
import test from "node:test";

import {
  documentRoute,
  entryRoute,
  isEntryPath,
  isPathSegment,
  isWindowsDeviceName,
  parseViewHref,
  previewMetadataPath,
  providerNormalizedHtmlPath,
  snapshotDocumentPath,
  snapshotResourcePath,
  snapshotSidePath,
  snapshotViewPath,
  viewHref,
  viewRoute,
} from "../src/data.js";

test("paths preserve ASCII case and reject nonportable segments", () => {
  for (const value of [
    "account-home",
    "Button",
    "0-start",
    "_",
    "__proto__",
    "constructor",
  ])
    assert.equal(isPathSegment(value), true, value);
  for (const value of [
    "",
    "bad/id",
    ".",
    "..",
    "has space",
    "é",
    "one.two",
    "aux",
    "CON",
    "com1",
    "LPT9",
    42,
    null,
  ])
    assert.equal(isPathSegment(value), false, String(value));
  assert.equal(isWindowsDeviceName("COM1"), true);
  assert.equal(isWindowsDeviceName(42), false);
  assert.equal(isEntryPath("account/Invoice"), true);
  for (const value of [
    "/account",
    "account/",
    "account//invoice",
    "account/../invoice",
    "account\\invoice",
    "account/%20",
    null,
  ])
    assert.equal(isEntryPath(value), false, String(value));
});

test("artifact names derive from paths and validated axes", () => {
  assert.equal(entryRoute("account/invoice"), "account/invoice/index.html");
  assert.equal(
    viewRoute("account/invoice", "mobile", "light"),
    "account/invoice/index.mobile.html",
  );
  assert.equal(
    viewRoute("components/action/disabled", "desktop", "dark"),
    "components/action/disabled/index.desktop.dark.html",
  );
  assert.equal(
    documentRoute("account/guide", "dark"),
    "account/guide/index.dark.html",
  );
  assert.equal(
    snapshotViewPath("before", "account/invoice", "mobile", "light"),
    "snapshots/before/account/invoice/index.mobile.html",
  );
  assert.equal(
    snapshotDocumentPath("before", "account/guide", "light"),
    "snapshots/before/account/guide/index.html",
  );
  assert.equal(
    previewMetadataPath("account/guide"),
    "previews/account/guide/index.json",
  );
  assert.equal(snapshotSidePath("after"), "snapshots/after/");
  assert.equal(
    snapshotResourcePath("before", "assets/arrow.svg"),
    "snapshots/before/assets/arrow.svg",
  );
  for (const call of [
    () => entryRoute("con"),
    () => documentRoute("guide", "sepia" as "light"),
    () => viewRoute("guide", "tablet" as "mobile", "light"),
    () => snapshotSidePath("sideways" as "before"),
    () =>
      snapshotViewPath(
        "sideways" as "before",
        "account/invoice",
        "mobile",
        "light",
      ),
    ...["", "../outside", "account/./invoice", "/absolute", "aux"].flatMap(
      (value) => [
        () => previewMetadataPath(value),
        () => viewHref(value),
        () => snapshotViewPath("before", value, "mobile", "light"),
      ],
    ),
    ...[
      "",
      "/root.css",
      "assets/../root.css",
      "assets\\root.css",
      "https:asset",
      "assets/\0root.css",
    ].map((value) => () => snapshotResourcePath("after", value)),
  ])
    assert.throws(call, /path/i);
});

test("view URLs accept the three forms and decode safe segments", () => {
  assert.equal(viewHref("account/Invoice"), "/view/account/Invoice/");
  for (const value of [
    "/view/account/Invoice/",
    "/view/account/Invoice",
    "/view/account/Invoice/index.html",
    "/view/account/%49nvoice/",
  ])
    assert.equal(parseViewHref(value), "account/Invoice", value);
  for (const value of ["constructor", "__proto__", "toString"])
    assert.equal(parseViewHref(`/view/${value}/`), value);
  for (const value of [
    "/view/",
    "/view/con/",
    "/view/a.html",
    "/view/a//b/",
    "/view/a/../b/",
    "/view/a/%2e%2e/b/",
    "/view/a%2fb/",
    "/view/a%5cb/",
    "/view/a%25b/",
    "/view/%/",
    "/view/a/?query=1",
    "/view/a/#fragment",
    "/other/a/",
  ])
    assert.equal(parseViewHref(value), undefined, value);
});

test("provider normalization confines shell and static artifact paths", () => {
  for (const [value, expected] of [
    ["/view/account/Invoice/", "/view/account/Invoice/"],
    ["/view/account/Invoice/index.html", "/view/account/Invoice/"],
    ["/static/account/Invoice/index.html", "/static/account/Invoice/"],
    [
      "/static/account/Invoice/index.mobile.html",
      "/static/account/Invoice/index.mobile",
    ],
  ] as const)
    assert.equal(providerNormalizedHtmlPath(value), expected);
  for (const value of [
    "/view/account/Invoice",
    "/static/../secret.html",
    "/static/./secret.html",
    "/static/%2e%2e/secret.html",
    "/static/a%2fb.html",
    "/static/a.html?query=1",
    "/static/a.html#id",
    "/other/a.html",
  ])
    assert.equal(providerNormalizedHtmlPath(value), undefined, value);
});
