import type { Page, Route } from "@playwright/test";

import type { Connection, Session, SessionIssued } from "../api/types";

import { appOrigin } from "./origins";

export const githubState = "a".repeat(64);
export const otherState = "b".repeat(64);
export const codeVerifier = "c".repeat(64);
export const workspaceId = "01994f10-0000-7000-8000-000000000044";

export const flowKeys = {
  signIn: "mkc:github-flow:sign-in",
  connect: "mkc:github-flow:connect",
  installSetup: "mkc:github-flow:install-setup",
  installAuthorize: "mkc:github-flow:install-authorize",
} as const;

export function callbackUrl(state = githubState): string {
  return `${appOrigin}/auth/github/callback?code=provider-code&state=${state}`;
}

export function installUrl(state = githubState): string {
  return (
    `${appOrigin}/auth/github/install?installation_id=42&state=${state}` +
    "&setup_action=install"
  );
}

export function connection(
  authorizeUrl: string,
  state = githubState,
): Connection {
  return { authorizeUrl, state, codeVerifier } satisfies Connection;
}

export function session(csrfToken = "csrf-original"): Session {
  return {
    user: {
      id: "01994f10-0000-7000-8000-000000000011",
      name: "person@example.com",
      email: "person@example.com",
      githubConnected: true,
    },
    csrfToken,
    workspaceIds: [workspaceId],
  } satisfies Session;
}

export function issued(
  returnTo: string,
  csrfToken = "csrf-rotated",
): SessionIssued {
  return { session: session(csrfToken), returnTo } satisfies SessionIssued;
}

export async function routeSignedInSession(page: Page): Promise<void> {
  await page.route("**/v1/session", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return json(route, session());
  });
}

export async function seedFlow(
  page: Page,
  key: string,
  state = githubState,
): Promise<void> {
  await page.evaluate(
    ({ storageKey, storedState, verifier }) => {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ state: storedState, codeVerifier: verifier }),
      );
    },
    { storageKey: key, storedState: state, verifier: codeVerifier },
  );
}

export async function storedFlow(
  page: Page,
  key: string,
): Promise<string | null> {
  return page.evaluate(
    (storageKey) => window.sessionStorage.getItem(storageKey),
    key,
  );
}

export function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
