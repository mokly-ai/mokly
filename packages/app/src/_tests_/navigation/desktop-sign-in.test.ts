import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { handoffToken } from "../../../../desktop/src/handoff";
import { callbackLandings } from "../../navigation/callback-input";
import {
  challengeFor,
  connectChallenge,
  connectDesktopAddress,
  createVerifier,
  desktopGrantAddress,
  desktopVerifierKey,
  keptDesktopVerifier,
  reusableGrant,
  storeDesktopVerifier,
  takeDesktopVerifier,
} from "../../navigation/desktop-sign-in";
import { memoryStorage, withRandomBytes, withWindow } from "../page-window";
import { repositoryRoot } from "../root";

/** The verifier and challenge pair the API's own tests exchange. */
const apiVerifier = "a".repeat(64);
const apiChallenge = "_-BU_nrgy23GXDr5th1SCfQ5hR20PQulmXM33xVGaOs";

test("a verifier is 32 random bytes written as 64 lowercase hex digits", async () => {
  await withRandomBytes(0xab, async () => {
    assert.equal(createVerifier(), "ab".repeat(32));
  });
  const verifiers = [createVerifier(), createVerifier()];
  for (const verifier of verifiers) assert.match(verifier, /^[0-9a-f]{64}$/);
  assert.notEqual(verifiers[0], verifiers[1]);
});

test("the challenge is the unpadded base64url SHA-256 of the verifier's text", async () => {
  // RFC 7636, appendix B, and the pair the API's own tests exchange.
  assert.equal(
    await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
  assert.equal(await challengeFor(apiVerifier), apiChallenge);
});

test("the window keeps one verifier in its tab and gives it up once", () => {
  const sessionStorage = memoryStorage();
  withWindow({ sessionStorage }, () => {
    assert.equal(keptDesktopVerifier(), undefined);
    storeDesktopVerifier("b".repeat(64));
    storeDesktopVerifier(apiVerifier);
    assert.equal(keptDesktopVerifier(), apiVerifier);
    assert.equal(keptDesktopVerifier(), apiVerifier);
    assert.equal(takeDesktopVerifier(), apiVerifier);
    assert.equal(takeDesktopVerifier(), undefined);
    assert.equal(keptDesktopVerifier(), undefined);

    for (const stored of ["A".repeat(64), "a".repeat(63), "", "a b"]) {
      sessionStorage.setItem(desktopVerifierKey, stored);
      assert.equal(takeDesktopVerifier(), undefined, stored);
      assert.equal(sessionStorage.getItem(desktopVerifierKey), null, stored);
    }
  });
  withWindow({ sessionStorage: memoryStorage(true) }, () => {
    assert.doesNotThrow(() => storeDesktopVerifier(apiVerifier));
    assert.equal(takeDesktopVerifier(), undefined);
  });
  withWindow(undefined, () => assert.equal(takeDesktopVerifier(), undefined));
});

test("the connect page carries the challenge and the entry screen's destination", () => {
  assert.equal(
    connectDesktopAddress(apiChallenge, "/acme/website?branch=topic%2Fwork"),
    "/connect/desktop?challenge=" +
      apiChallenge +
      "&returnTo=%2Facme%2Fwebsite%3Fbranch%3Dtopic%252Fwork",
  );
  // An entry screen with no destination holds the dashboard, which the API
  // restores for a grant requested without one.
  assert.equal(
    connectDesktopAddress(apiChallenge, "/dashboard"),
    "/connect/desktop?challenge=" + apiChallenge,
  );
});

test("the connect page reads exactly one challenge of 43 base64url characters", () => {
  assert.equal(connectChallenge("?challenge=" + apiChallenge), apiChallenge);
  assert.equal(
    connectChallenge("?returnTo=%2Fdashboard&challenge=" + apiChallenge),
    apiChallenge,
  );
  for (const search of [
    "",
    "?challenge=",
    "?challenge=" + apiChallenge + "&challenge=" + apiChallenge,
    "?challenge=" + apiChallenge.slice(1),
    "?challenge=" + apiChallenge + "A",
    "?challenge=" + apiChallenge.slice(1) + "=",
    "?challenge=" + apiChallenge.slice(1) + "%2B",
    "?verifier=" + apiChallenge,
  ]) {
    assert.equal(connectChallenge(search), undefined, search);
  }
});

test("Open Mokly opens the desktop landing on the app's own scheme, which the shell accepts", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(repositoryRoot, "packages/app/app.json"), "utf8"),
  ) as { expo: { scheme: string } };
  const grant = "0123456789abcdef".repeat(4);
  const handoff = desktopGrantAddress(grant);
  assert.equal(handoff, "mokly://auth/desktop/callback#grant=" + grant);

  const address = new URL(handoff);
  assert.equal(address.protocol, manifest.expo.scheme + ":");
  assert.equal(
    "/" + address.host + address.pathname,
    callbackLandings.desktop.route,
  );
  assert.equal(address.search, "");
  assert.deepEqual(
    [...new URLSearchParams(address.hash.slice(1))],
    [["grant", grant]],
  );
  assert.equal(handoffToken(handoff), grant);
});

test("a held grant is handed over again only until it expires", () => {
  const held = { grant: "c".repeat(64), expiresAt: "2026-11-06T12:05:00Z" };
  const expiry = Date.parse("2026-11-06T12:05:00Z");
  assert.equal(reusableGrant(undefined, expiry - 1), false);
  assert.equal(reusableGrant(held, expiry - 1), true);
  assert.equal(reusableGrant(held, expiry), false);
  assert.equal(reusableGrant(held, expiry + 1), false);
  assert.equal(
    reusableGrant({ ...held, expiresAt: "not a time" }, expiry - 1),
    false,
  );
});
