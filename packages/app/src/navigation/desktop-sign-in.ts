/**
 * Desktop sign-in through the browser, as `desktop-sign-in.md` defines it: the
 * window keeps a verifier and opens the connect page for its challenge, the
 * connect page hands the window one grant through the `mokly` scheme, and the
 * window's landing exchanges the grant with the verifier.
 */

import type { DesktopGrantResult } from "../api/types";

import { connectDesktopPath } from "./paths";
import { one } from "./provider-query";
import { defaultDestination } from "./return-to";
import { openOnWeb } from "./web-setup";

/** The tab-scoped storage key the window keeps its verifier under. */
export const desktopVerifierKey = "mkc:desktop-sign-in";

/** A verifier: 32 random bytes as 64 lowercase hex digits. */
const verifierForm = /^[0-9a-f]{64}$/;

/** The S256 challenge the API admits: 43 base64url characters. */
const challengeForm = /^[A-Za-z0-9_-]{43}$/;

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** A new verifier: 32 cryptographically random bytes as 64 lowercase hex. */
export function createVerifier(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const digits = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  );
  return digits.join("");
}

/**
 * The S256 challenge of one verifier: the base64url encoding, without padding,
 * of the SHA-256 digest of the verifier's text.
 */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Keep the window's verifier in this tab in place of any earlier one. A store
 * the browser refuses keeps nothing, and the landing then finds no verifier,
 * which is the recovery it already draws.
 */
export function storeDesktopVerifier(verifier: string): void {
  try {
    browserStorage()?.setItem(desktopVerifierKey, verifier);
  } catch {
    // Nothing kept: the landing draws the expired sign-in.
  }
}

/** The verifier this tab keeps, if any, read without taking it. */
export function keptDesktopVerifier(): string | undefined {
  let value: string | null;
  try {
    value = browserStorage()?.getItem(desktopVerifierKey) ?? null;
  } catch {
    return undefined;
  }
  return value !== null && verifierForm.test(value) ? value : undefined;
}

/**
 * Take the window's verifier out of this tab, once. Taking removes it, so a
 * reload or a later landing finds none. Anything in its place that is not a
 * verifier is removed the same way and read as none.
 */
export function takeDesktopVerifier(): string | undefined {
  const value = keptDesktopVerifier();
  try {
    browserStorage()?.removeItem(desktopVerifierKey);
  } catch {
    return undefined;
  }
  return value;
}

/**
 * The connect page for one challenge, as a root-relative address. It carries
 * the entry screen's validated `returnTo`, except the default destination: an
 * entry screen with no `returnTo` holds the default, and the API restores the
 * default for a grant requested without one.
 */
export function connectDesktopAddress(
  challenge: string,
  returnTo: string,
): string {
  const query = "?challenge=" + encodeURIComponent(challenge);
  return returnTo === defaultDestination
    ? connectDesktopPath + query
    : connectDesktopPath + query + "&returnTo=" + encodeURIComponent(returnTo);
}

/**
 * Open the connect page for one verifier's challenge in the browser, carrying
 * the entry screen's destination. The same verifier always opens the same
 * page, so a grant from any browser tab opened for it signs the window in.
 */
export async function openConnectPage(
  verifier: string,
  returnTo: string,
): Promise<void> {
  openOnWeb(connectDesktopAddress(await challengeFor(verifier), returnTo));
}

/**
 * Start desktop sign-in from the window's entry screen: create a verifier, keep
 * it in this tab in place of any earlier one, and open the connect page for its
 * challenge in the browser. Answers the verifier, for which Open browser again
 * opens the same page.
 */
export async function startDesktopSignIn(returnTo: string): Promise<string> {
  const verifier = createVerifier();
  storeDesktopVerifier(verifier);
  await openConnectPage(verifier, returnTo);
  return verifier;
}

/**
 * The connect page's one challenge, or nothing when its query does not carry
 * exactly one value of 43 base64url characters.
 */
export function connectChallenge(search: string): string | undefined {
  const value = one(new URLSearchParams(search), "challenge");
  return value !== undefined && challengeForm.test(value) ? value : undefined;
}

/**
 * The scheme address that hands one grant to the desktop app: the desktop
 * landing on the `mokly` scheme that `app.json` declares, with the grant in the
 * fragment, which is exactly the address the shell accepts.
 */
export function desktopGrantAddress(grant: string): string {
  const fragment = new URLSearchParams({ grant }).toString();
  return "mokly://auth/desktop/callback#" + fragment;
}

/**
 * Whether the grant the connect page holds can be handed to the app again at
 * `now`, in milliseconds since the epoch: it has not expired. A press after
 * it expires requests a new one.
 */
export function reusableGrant(
  held: DesktopGrantResult | undefined,
  now: number,
): held is DesktopGrantResult {
  return held !== undefined && now < Date.parse(held.expiresAt);
}
