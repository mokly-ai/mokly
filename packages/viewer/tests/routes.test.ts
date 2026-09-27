import assert from "node:assert/strict";
import test from "node:test";

import {
  entryRoute,
  isCatalogueId,
  isEntryId,
  isWindowsDeviceName,
  parseViewHref,
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
    "/screens/account-home.html",
    "/view/screens/account-home.html?fragment=hero",
  ]) {
    assert.equal(parseViewHref(value), undefined, value);
  }
});
