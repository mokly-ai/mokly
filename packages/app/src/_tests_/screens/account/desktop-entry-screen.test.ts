import assert from "node:assert/strict";
import { test } from "node:test";

import { createElement } from "react";

import { icons } from "../../../components/icons";
import { appOrigin } from "../../../config";
import { desktopVerifierKey } from "../../../navigation/desktop-sign-in";
import {
  shellPage,
  tabAt,
  withRandomBytes,
  withWindowAsync,
} from "../../page-window";
import { draw, recordingPage, until } from "../../server-render";

/** The verifier 32 bytes of 0xaa make, which the API's own tests exchange. */
const verifier = "a".repeat(64);

/** The connect page for that verifier, carrying the entry's destination. */
const connectPage = [
  appOrigin +
    "/connect/desktop?challenge=_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs" +
    "&returnTo=%2Facme%2Fwebsite",
  "_blank",
  "noopener,noreferrer",
];

/** The entry screen, loaded through the doubles. */
async function entry(mode: "sign-in" | "sign-up") {
  const { EntryScreen } = await import("../../../screens/account/entry-screen");
  return createElement(EntryScreen, { mode, returnTo: "/acme/website" });
}

/** The sign-in screen's wait that the session guard draws, loaded likewise. */
async function signInWait() {
  const { SignInWait } = await import("../../../screens/account/entry-screen");
  return createElement(SignInWait);
}

test("the window's entry draws one action that opens the browser", async () => {
  for (const mode of ["sign-in", "sign-up"] as const) {
    const screen = await entry(mode);
    const { html, buttons } = draw(recordingPage(shellPage()).page, screen);
    assert.deepEqual(
      buttons.map((button) => [button.label, button.icon]),
      [["Continue in browser", icons.external]],
      mode,
    );
    assert.doesNotMatch(html, /<input/, mode);
    assert.doesNotMatch(html, /fo-account-switch/, mode);

    const browser = draw(recordingPage(tabAt()).page, screen);
    assert.deepEqual(
      browser.buttons.map((button) => button.label),
      ["Continue with GitHub", "Continue with email"],
      mode,
    );
  }
});

test("Continue in browser keeps a verifier and opens the connect page for it", async () => {
  const window = recordingPage(shellPage());
  const { buttons } = draw(window.page, await entry("sign-in"));
  await withWindowAsync(window.page, () =>
    withRandomBytes(0xaa, async () => {
      buttons[0].onPress?.();
      await until(() => window.opened.length > 0);
    }),
  );
  assert.deepEqual(window.opened, [connectPage]);
  assert.equal(
    window.page.sessionStorage.getItem(desktopVerifierKey),
    verifier,
  );
  assert.deepEqual(window.assigned, []);
});

test("a window that keeps a verifier waits, and opens the same page again", async () => {
  const window = recordingPage(shellPage());
  window.page.sessionStorage.setItem(desktopVerifierKey, verifier);
  const { html, buttons } = draw(window.page, await entry("sign-up"));
  assert.match(html, /<h1>Check your browser<\/h1>/);
  assert.deepEqual(
    buttons.map((button) => [button.label, button.icon]),
    [["Open browser again", icons.external]],
  );
  await withWindowAsync(window.page, async () => {
    buttons[0].onPress?.();
    await until(() => window.opened.length > 0);
  });
  assert.deepEqual(window.opened, [connectPage]);
  assert.equal(
    window.page.sessionStorage.getItem(desktopVerifierKey),
    verifier,
  );
});

test("in the window, the session guard's sign-in wait is the window's entry", async () => {
  const window = recordingPage(shellPage());
  const { html, buttons } = draw(window.page, await signInWait());
  // The window's own panel, so nothing moves when its entry replaces it, and
  // no email field or GitHub action, which the window cannot use.
  assert.match(html, /<h1>Sign in to Mokly<\/h1>/);
  assert.deepEqual(
    buttons.map((button) => [button.label, button.icon]),
    [["Continue in browser", icons.external]],
  );
  assert.doesNotMatch(html, /<input/);
  assert.match(html, /class="fo-wait" aria-busy="true"/);
  assert.match(html, /role="status">Opening Mokly…<\/span>/);
  // Its action waits with it: a press opens nothing.
  buttons[0].onPress?.();
  assert.deepEqual(window.opened, []);

  // A window that keeps a verifier waits for its grant, and so does its wait.
  const kept = recordingPage(shellPage());
  kept.page.sessionStorage.setItem(desktopVerifierKey, verifier);
  const waiting = draw(kept.page, await signInWait());
  assert.match(waiting.html, /<h1>Check your browser<\/h1>/);
  assert.deepEqual(
    waiting.buttons.map((button) => button.label),
    ["Open browser again"],
  );

  // In a browser tab the guard draws the browser's sign-in, waiting.
  const browser = draw(recordingPage(tabAt()).page, await signInWait());
  assert.deepEqual(
    browser.buttons.map((button) => button.label),
    ["Continue with GitHub", "Continue with email"],
  );
});
