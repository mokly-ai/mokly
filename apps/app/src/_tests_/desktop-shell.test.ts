import assert from "node:assert/strict";
import { test } from "node:test";

import { desktopOrigin, isDesktopShell } from "../navigation/desktop-shell";

import { fixtureDesktopOrigin } from "./desktop-fixture";
import { shellPage, tabAt, withWindow } from "./page-window";

test("the desktop origin is the literal the shared fixture pins", () => {
  assert.equal(desktopOrigin, fixtureDesktopOrigin);
});

test("only a page served from the desktop origin is the shell", () => {
  withWindow({ location: shellPage() }, () => {
    assert.equal(isDesktopShell(), true);
  });
  for (const address of [
    "http://localhost:8081/auth/desktop/callback",
    "https://mokly.ai/dashboard",
    "https://desktop.mokly.ai/mokly-app/",
  ]) {
    withWindow({ location: tabAt(address) }, () => {
      assert.equal(isDesktopShell(), false, address);
    });
  }
  // iOS and Android have a window without a location; server rendering and
  // these tests have no window at all.
  withWindow({}, () => assert.equal(isDesktopShell(), false));
  withWindow(undefined, () => assert.equal(isDesktopShell(), false));
});
