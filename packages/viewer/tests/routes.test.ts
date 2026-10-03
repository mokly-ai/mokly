import assert from "node:assert/strict";
import test from "node:test";

import {
  entryRoute,
  isCatalogueId,
  isEntryId,
  isWindowsDeviceName,
  pagePreviewMetadataPath,
  parseViewHref,
  providerNormalizedHtmlPath,
  snapshotPagePath,
  snapshotResourcePath,
  snapshotSidePath,
  snapshotViewPath,
  unavailableViewHref,
  viewHref,
  viewRoute,
} from "../src/data.js";

test("entry ids exclude portable Windows device names without changing catalogue ids", () => {
  for (const value of ["account-home", "screen-1", "0-start"]) {
    assert.equal(isCatalogueId(value), true, value);
    assert.equal(isEntryId(value), true, value);
    assert.equal(isWindowsDeviceName(value), false, value);
  }
  for (const value of [
    "aux",
    "con",
    "nul",
    "prn",
    "com1",
    "com9",
    "lpt1",
    "lpt9",
  ]) {
    assert.equal(isCatalogueId(value), true, value);
    assert.equal(isEntryId(value), false, value);
    assert.equal(isWindowsDeviceName(value), true, value);
  }
  for (const value of ["COM1", "bad/id", "Upper", "", 42, null]) {
    assert.equal(isEntryId(value), false, String(value));
  }
  assert.equal(isWindowsDeviceName("COM1"), true);
  assert.equal(isWindowsDeviceName(42), false);
});

test("entry routes derive from kind and id", () => {
  assert.equal(
    entryRoute("screen", "account-home"),
    "screens/account-home.html",
  );
  assert.equal(entryRoute("page", "account-home"), "pages/account-home.html");
  assert.equal(
    entryRoute("use-case", "account-home"),
    "user-flows/account-home.html",
  );
  assert.equal(
    entryRoute("component", "account-home"),
    "components/account-home.html",
  );
});

test("view routes derive every axis from entry identity", () => {
  assert.equal(
    viewRoute("screen", "account-home", "mobile", "light"),
    "screens/account-home.mobile.html",
  );
  assert.equal(
    viewRoute("component", "action-disabled", "desktop", "dark"),
    "components/action-disabled.desktop.dark.html",
  );
});

test("comparison and removed-page paths derive from identity", () => {
  assert.equal(
    snapshotViewPath("before", "screen", "account-home", "mobile", "light"),
    "snapshots/before/mokly-generated/screens/account-home.mobile.html",
  );
  assert.equal(
    snapshotViewPath(
      "after",
      "component",
      "action-disabled",
      "desktop",
      "dark",
    ),
    "snapshots/after/mokly-generated/components/action-disabled.desktop.dark.html",
  );
  assert.equal(
    snapshotPagePath("archived-guide"),
    "snapshots/before/mokly-generated/pages/archived-guide.html",
  );
  assert.equal(
    pagePreviewMetadataPath("archived-guide"),
    "pages/archived-guide.json",
  );
  assert.equal(snapshotSidePath("before"), "snapshots/before/");
  assert.equal(snapshotSidePath("after"), "snapshots/after/");
  assert.equal(
    snapshotResourcePath("before", "assets/icons/arrow.svg"),
    "snapshots/before/assets/icons/arrow.svg",
  );
  for (const call of [
    () => snapshotViewPath("before", "screen", "con", "mobile", "light"),
    () =>
      snapshotViewPath(
        "sideways" as "before",
        "screen",
        "account-home",
        "mobile",
        "light",
      ),
    () => snapshotPagePath("bad/id"),
    () => pagePreviewMetadataPath("bad.id"),
    () => snapshotSidePath("sideways" as "before"),
    () => snapshotResourcePath("after", ""),
    () => snapshotResourcePath("after", "/root.css"),
    () => snapshotResourcePath("after", "assets/../root.css"),
    () => snapshotResourcePath("after", "assets\\root.css"),
    () => snapshotResourcePath("after", "https:asset.test/root.css"),
    () => snapshotResourcePath("after", "assets/\0root.css"),
  ])
    assert.throws(call, /path/i);
});

test("view hrefs and their parser share the canonical route grammar", () => {
  assert.equal(
    viewHref("screen", "account-home"),
    "/view/screens/account-home.html",
  );
  assert.deepEqual(parseViewHref("/view/screens/account-home.html"), {
    id: "account-home",
    kind: "screen",
  });
  assert.deepEqual(parseViewHref("/view/components/action"), {
    id: "action",
    kind: "component",
  });
  assert.deepEqual(parseViewHref("/view/pages/guide.html"), {
    id: "guide",
    kind: "page",
  });
  assert.deepEqual(parseViewHref("/view/user-flows/getting-started"), {
    id: "getting-started",
    kind: "use-case",
  });
  for (const value of [
    "/view/screens/con.html",
    "/view/screens/UPPER.html",
    "/view/screens/nested/id.html",
    "/view/screens/account-home.mobile.html",
    "/view/constructor/account-home.html",
    "/view/__proto__/account-home.html",
    "/view/toString/account-home.html",
    "/screens/account-home.html",
    "/view/screens/account-home.html?fragment=hero",
  ]) {
    assert.equal(parseViewHref(value), undefined, value);
  }
});

test("browser path helpers normalize only confined HTML artifacts", () => {
  for (const [value, expected] of [
    ["/view/screens/account-home.html", "/view/screens/account-home"],
    [
      "/static/mokly-generated/screens/account-home.mobile.html",
      "/static/mokly-generated/screens/account-home.mobile",
    ],
    ["/static/assets/nested/example.html", "/static/assets/nested/example"],
  ] as const)
    assert.equal(providerNormalizedHtmlPath(value), expected, value);

  for (const value of [
    "/view/screens/account-home",
    "/view/constructor/account-home.html",
    "/static/../secret.html",
    "/static/mokly-generated/screens/./account-home.html",
    "/static/mokly-generated/screens/%2fsecret.html",
    "/static/mokly-generated/screens/account-home.html?mode=dark",
    "/static/mokly-generated/screens/account-home.html#section",
    "/other/screens/account-home.html",
  ])
    assert.equal(providerNormalizedHtmlPath(value), undefined, value);

  assert.equal(unavailableViewHref("missing/id"), "/view/missing%2Fid");
});
