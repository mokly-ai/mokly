import { createHash, randomBytes } from "node:crypto";

import type { Locator, Page, Request } from "@playwright/test";

import type { DesktopGrantResult } from "../api/types";
import { desktopVerifierKey } from "../navigation/desktop-sign-in";

import { expect } from "./harness";
import { apiOrigin } from "./origins";

/**
 * A verifier of the window's own form, made here rather than by the entry
 * screen, which only the desktop shell draws, and its S256 challenge.
 */
export function freshVerifier(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("hex");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

/** What a connect page did: its grant requests and its scheme navigations. */
export interface ConnectLog {
  /** Every grant request the page sent, in order. */
  requests: Request[];
  /** Every navigation the page asked its own tab for to the `mokly` scheme. */
  schemes: { url: string; disposition: string }[];
}

/**
 * Record each grant request the page sends and each navigation it asks its own
 * tab to make to the `mokly` scheme. The browser hands a scheme address to the
 * operating system and the page stays where it is, so the request is all
 * there is to observe.
 */
export async function recordConnect(page: Page): Promise<ConnectLog> {
  const log: ConnectLog = { requests: [], schemes: [] };
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url() === apiOrigin + "/v1/auth/desktop/grants"
    ) {
      log.requests.push(request);
    }
  });
  const session = await page.context().newCDPSession(page);
  await session.send("Page.enable");
  session.on("Page.frameRequestedNavigation", (event) => {
    if (!event.url.startsWith("mokly:")) return;
    log.schemes.push({ url: event.url, disposition: event.disposition });
  });
  return log;
}

/**
 * Press Open Mokly, or Try again where a press was refused, wait for the grant
 * it requested and answer when that grant expires, in milliseconds since the
 * epoch. The API admits twenty grant requests per peer address per minute,
 * and no spec here asks for more than two.
 */
export async function requestGrant(page: Page): Promise<number> {
  const answered = page.waitForResponse(
    (answer) =>
      answer.url() === apiOrigin + "/v1/auth/desktop/grants" &&
      answer.request().method() === "POST",
  );
  await page.getByTestId("open-mokly").click();
  const answer = await answered;
  expect(answer.status(), "the API issues the grant").toBe(201);
  const issued = (await answer.json()) as DesktopGrantResult;
  return Date.parse(issued.expiresAt);
}

/** The one grant a scheme address carries, read without ever printing it. */
export function grantOf(address: string): string {
  const url = new URL(address);
  expect(url.protocol + "//" + url.host + url.pathname).toBe(
    "mokly://auth/desktop/callback",
  );
  const grants = new URLSearchParams(url.hash.slice(1)).getAll("grant");
  expect(
    grants.length === 1 && /^[0-9a-f]{64}$/.test(grants[0]),
    "the fragment carries one 64-hex grant",
  ).toBe(true);
  return grants[0];
}

/**
 * Keep a verifier in this tab, where the window's entry screen keeps it. Only
 * the desktop shell draws that screen, so a browser tab has to be given the
 * state the screen would have left.
 */
export async function keepVerifier(
  page: Page,
  verifier: string,
): Promise<void> {
  await page.evaluate(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    [desktopVerifierKey, verifier] as const,
  );
}

/** The verifier this tab still keeps, if any. */
export async function keptVerifier(page: Page): Promise<string | null> {
  return page.evaluate(
    (key) => window.sessionStorage.getItem(key),
    desktopVerifierKey,
  );
}

/** Whom this page's browser is signed in as, read from the API itself. */
export async function signedInAs(page: Page): Promise<string | number> {
  return page.evaluate(async (origin) => {
    const response = await fetch(origin + "/v1/session", {
      credentials: "include",
    });
    if (!response.ok) return response.status;
    return ((await response.json()) as { user: { email: string } }).user.email;
  }, apiOrigin);
}

/** The destination every connect page here carries, with an escape in its query. */
export const connectReturnTo = "/acme/website?branch=topic%2Fwork";

/** The page's own controls, in order. */
export function controls(page: Page) {
  return page.locator("main").getByRole("button");
}

/** Lucide's arrow-up-right in one control, the glyph of a control that leaves. */
export function externalGlyphIn(control: Locator) {
  return control.locator('svg path[d="M7 17 17 7"]');
}

/** That glyph on Open Mokly. */
export function externalGlyph(page: Page) {
  return externalGlyphIn(page.getByTestId("open-mokly"));
}

/** The confirmation that names the browser's account before the app gets it. */
export async function expectConfirmation(
  page: Page,
  email: string,
): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in to the Mokly app" }),
  ).toBeVisible();
  await expect(page.locator(".fo-account-detail")).toHaveText(
    "Signed in as " + email,
  );
  await expect(page.locator(".fo-account-header")).toContainText(email);
  await expect(controls(page)).toHaveText([
    "Open Mokly",
    "Use another account",
  ]);
  // The external glyph on the control that leaves the browser, and none on
  // the one that stays.
  await expect(externalGlyph(page)).toHaveCount(1);
  await expect(
    page.getByTestId("use-another-account").locator("svg"),
  ).toHaveCount(0);
}
