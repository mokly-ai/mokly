import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test as base } from "@playwright/test";
import type { Dialog, Page } from "@playwright/test";

import type { operations } from "../api/generated/schema";
import { signUpPath } from "../navigation/paths";

import { apiOrigin } from "./origins";
import { admitLinkRequest, mailedLink } from "./sign-in-links";

/**
 * The JSON body one API operation answers with.
 *
 * A browser test that stands in for an answer is held to this, so a field
 * added to the contract fails typecheck here rather than drifting into a
 * fixture nobody re-read: the Milestone 1 review found an `Workspace`
 * literal silently missing `plan` exactly that way.
 */
export type ApiBody<Name extends keyof operations> =
  operations[Name]["responses"] extends {
    200: { content: { "application/json": infer Body } };
  }
    ? Body
    : never;

const skipMarker = resolve(process.cwd(), ".expo/app-tests/skip.txt");

function skipReason(): string {
  if (!existsSync(skipMarker)) return "";
  return readFileSync(skipMarker, "utf8").trim();
}

/**
 * Every test needs the real API; only local database unavailability may skip.
 *
 * The admission check is an automatic fixture, not a `test.beforeEach` at
 * module level. A hook registered while a module loads belongs only to the
 * spec file being loaded at that moment; Node then caches this module, so the
 * next spec file the same worker loads would import the shared `test` without
 * ever registering the hook. A fixture is attached to the `test` object itself
 * and applies to every test declared through it, in every file and on every
 * attempt.
 */
export const test = base.extend<{ admitted: void }>({
  admitted: [
    // Playwright requires the fixture argument to be a destructuring pattern,
    // even when nothing is used; the lint rule is disabled here for that reason.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      const reason = skipReason();
      testInfo.skip(reason.length > 0, reason);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * A fresh address, so one run never inherits another's account. The API stores
 * an address lowercased, so the label is too — otherwise the link this run
 * looks for in the mailer's log is not the one the server wrote.
 */
export function freshEmail(label: string): string {
  const stem = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${stem}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Every screen root carries `data-mkc-screen`, and the application only renders
 * one once its session has resolved. Waiting for it is the readiness signal a
 * navigation needs; a fixed pause would be a guess about a slow machine.
 */
export async function ready(page: Page): Promise<void> {
  await expect(page.locator("[data-mkc-screen]").first()).toBeVisible();
}

/** Wait until navigation has rendered the exact completed screen expected. */
export async function readyScreen(page: Page, screen: string): Promise<void> {
  await expect(page.locator(`[data-mkc-screen="${screen}"]`)).toBeVisible();
}

/** Navigate, then wait until the application has actually rendered a screen. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await ready(page);
}

/**
 * Open sign in and wait until it has read the configuration answer. Until
 * then it draws its wait, which looks like the form, so a test that moves
 * focus or measures the page starts from the form itself.
 */
export async function openSignIn(page: Page): Promise<void> {
  await open(page, "/sign-in");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Sign one new person in through the real magic-link process. */
export async function signIn(
  page: Page,
  email: string,
  returnTo?: string,
): Promise<void> {
  const entry = returnTo
    ? `${signUpPath}?returnTo=${encodeURIComponent(returnTo)}`
    : signUpPath;
  await open(page, entry);
  await page.getByLabel("Email").fill(email);
  const submit = page.getByTestId("email-entry");
  await expect(submit).toBeEnabled();
  await admitLinkRequest(page, async () => {
    const sent = page.waitForResponse(
      (answer) => answer.url().endsWith("/v1/auth/magic-links"),
      { timeout: 60_000 },
    );
    await submit.click();
    return sent;
  });
  await page.waitForURL(/auth\/email/);
  await expect(page.getByText(email).first()).toBeVisible();
  await openMagicLink(page, email);
}

/** Open the one-use credential without ever including it in a test diagnostic. */
export async function openMagicLink(page: Page, email: string): Promise<void> {
  await navigateMagicLink(page, await mailedLink(email));
  // The callback screen renders while it is still exchanging the credential,
  // so wait for it to hand over: navigating away before it does cancels the
  // exchange and leaves the reader signed out.
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/auth/email/callback"),
  );
  await ready(page);
}

/** Navigate with a credential without exposing its URL in Playwright errors. */
export async function navigateMagicLink(
  page: Page,
  link: string,
): Promise<void> {
  try {
    await page.goto(link);
  } catch {
    throw new Error("[app/tests] Could not open the sign-in callback");
  }
}

/**
 * Navigate to a `?settings=` address, or to a durable settings route, and wait
 * for the dialog over its page. A durable route on a wide surface draws the
 * dialog's wait until it hands over by replacing its address, so the dialog is
 * the reader's once the address carries it.
 */
export async function openDialog(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.searchParams.has("settings"));
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** The workspace the signed-in reader belongs to, read from the real API. */
export async function currentWorkspaceId(page: Page): Promise<string> {
  return page.evaluate(async (origin) => {
    const answer = await fetch(origin + "/v1/workspaces", {
      credentials: "include",
    });
    const body = (await answer.json()) as { items: { id: string }[] };
    return body.items[0].id;
  }, apiOrigin);
}

/** Whether the browser's own prompt is in place for a draft on this page. */
export async function unloadGuard(page: Page): Promise<boolean> {
  return page.evaluate(() => typeof window.onbeforeunload === "function");
}

/**
 * Drive an exit the page cannot intercept and report the browser's own prompts.
 * A dismissed prompt cancels the navigation, so `go` does not settle before its
 * own timeout: the dismissed prompt is the signal to return. A navigation that
 * needs no prompt settles `go` instead, and the list stays empty.
 */
export async function leaveDocument(
  page: Page,
  go: () => Promise<unknown>,
): Promise<string[]> {
  const prompts: string[] = [];
  let dismissed = (): void => undefined;
  const prompted = new Promise<void>((resolve) => (dismissed = resolve));
  const seen = (dialog: Dialog) => {
    prompts.push(dialog.type());
    void dialog.dismiss().then(dismissed);
  };
  page.on("dialog", seen);
  await Promise.race([go().catch(() => undefined), prompted]);
  page.off("dialog", seen);
  return prompts;
}
