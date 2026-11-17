import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { callbackLandings } from "../navigation/callback-input";
import {
  desktopHandoffAddress,
  desktopOrigin,
  isDesktopShell,
  offersDesktopHandoff,
} from "../navigation/desktop-shell";

import { fixtureDesktopOrigin } from "./desktop-fixture";
import { shellPage, tabAt, withWindow } from "./page-window";
import { repositoryRoot } from "./root";

const landing = "http://localhost:8081/auth/email/callback";

test("the desktop origin is the literal the shared fixture pins", () => {
  assert.equal(desktopOrigin, fixtureDesktopOrigin);
});

test("only a page served from the desktop origin is the shell", () => {
  withWindow({ location: shellPage() }, () => {
    assert.equal(isDesktopShell(), true);
  });
  for (const address of [
    landing,
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

test("a link the shell requested is handed back only outside the shell", () => {
  withWindow({ location: tabAt(landing) }, () => {
    assert.equal(offersDesktopHandoff("?client=desktop"), true);
    assert.equal(offersDesktopHandoff("?source=mail&client=desktop"), true);
    for (const search of [
      "",
      "?source=mail",
      "?client=web",
      "?client=",
      "?client=Desktop",
      "?client=desktop&client=desktop",
    ]) {
      assert.equal(offersDesktopHandoff(search), false, search);
    }
  });
  withWindow({ location: shellPage() }, () => {
    assert.equal(offersDesktopHandoff("?client=desktop"), false);
  });
});

test("the handoff address is the email landing on the app's own scheme", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(repositoryRoot, "apps/app/app.json"), "utf8"),
  ) as { expo: { scheme: string } };
  const token = "0123456789abcdef".repeat(4);
  const handoff = desktopHandoffAddress(token);
  assert.equal(handoff, `mokly://auth/email/callback#token=${token}`);

  const address = new URL(handoff);
  assert.equal(address.protocol, manifest.expo.scheme + ":");
  assert.equal(
    "/" + address.host + address.pathname,
    callbackLandings.email.route,
  );
  assert.equal(address.search, "");
  assert.deepEqual(
    [...new URLSearchParams(address.hash.slice(1))],
    [["token", token]],
  );
});

test("a token the API did not issue still arrives whole", () => {
  const token = "a b&c#d=e";
  const address = new URL(desktopHandoffAddress(token));
  assert.deepEqual(new URLSearchParams(address.hash.slice(1)).getAll("token"), [
    token,
  ]);
});
