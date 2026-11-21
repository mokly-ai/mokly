import { randomBytes } from "node:crypto";

import type { Page } from "@playwright/test";

import { connectDesktopAddress } from "../navigation/desktop-sign-in";

import { recordAddresses, recordedAddresses } from "./address-log";
import { failWith } from "./api-responses";
import {
  freshVerifier,
  grantOf,
  keepVerifier,
  keptVerifier,
  recordConnect,
  requestGrant,
  signedInAs,
} from "./desktop-sign-in";
import { stateDocumentViolations } from "./document-policy";
import { failureFor } from "./failures";
import { expect, freshEmail, open, signIn, test } from "./harness";
import { apiOrigin } from "./origins";
import { expectScreenPolicy } from "./screen-policy";

/** Where the landing is loaded, as the desktop shell loads it. */
const landing = "/auth/desktop/callback";

/** A grant the API never issued, in the form the shell accepts. */
function unknownGrant(): string {
  return randomBytes(32).toString("hex");
}

/** Every exchange the page sends. */
function countExchanges(page: Page): () => number {
  let sent = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url() === apiOrigin + "/v1/auth/desktop/callback"
    ) {
      sent += 1;
    }
  });
  return () => sent;
}

/**
 * A grant the connect page handed out for `challenge`, carrying `destination`,
 * for a fresh account. The page then forgets the browser's session, because
 * the window it plays next keeps a cookie store of its own.
 */
async function browserGrant(
  page: Page,
  challenge: string,
  destination: string,
): Promise<{ email: string; grant: string }> {
  const email = freshEmail("desktop-browser");
  await signIn(page, email);
  const log = await recordConnect(page);
  await open(page, connectDesktopAddress(challenge, destination));
  await requestGrant(page);
  await expect.poll(() => log.schemes.length).toBe(1);
  await page.context().clearCookies();
  return { email, grant: grantOf(log.schemes[0].url) };
}

/**
 * One failed landing, as the shared problem state draws it: one alert that
 * announces the title, and Back to sign in as the only way on.
 */
async function expectFailed(page: Page, title: string): Promise<void> {
  await expect(
    page.getByRole("heading", { level: 1, name: title }),
  ).toBeVisible();
  const alert = page.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert.locator(".fo-sr-only")).toHaveText(title);
  await expect(page.locator("main").getByRole("button")).toHaveText([
    "Back to sign in",
  ]);
  await expectScreenPolicy(page, title);
  expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
}

/** The closed disclosure that holds an API failure's reference. */
async function expectReference(page: Page, reference: string): Promise<void> {
  const details = page.locator("details");
  await expect(details).toHaveCount(1);
  await expect(details).not.toHaveAttribute("open");
  await page.locator("summary", { hasText: "Details" }).click();
  await expect(details).toContainText(reference);
}

test("a grant and its verifier sign the window in and resume the grant's destination", async ({
  page,
}) => {
  const { verifier, challenge } = freshVerifier();
  const destination = "/new?source=desktop%2Fapp";
  const { email, grant } = await browserGrant(page, challenge, destination);
  expect(await signedInAs(page), "the window starts signed out").toBe(401);

  const exchanges = countExchanges(page);
  await open(page, "/sign-in");
  await keepVerifier(page, verifier);
  await recordAddresses(page);
  await page.goto(`${landing}?source=app#grant=${grant}`);
  await page.waitForURL((url) => url.pathname + url.search === destination);
  expect(await signedInAs(page)).toBe(email);
  expect(exchanges()).toBe(1);
  expect(await keptVerifier(page)).toBeNull();

  const [first = "", ...later] = await recordedAddresses(page);
  expect(first.includes("#grant="), "the landing loaded with its grant").toBe(
    true,
  );
  expect(later.length, "the landing wrote its address").toBeGreaterThan(0);
  expect(
    later.filter((address) => address.includes("grant=")).length,
    "no later address carries the grant",
  ).toBe(0);
});

test("a grant the API refuses shows the expired sign-in, which starts again", async ({
  page,
}) => {
  const exchanges = countExchanges(page);
  await open(page, "/sign-in");
  await keepVerifier(page, freshVerifier().verifier);
  const refused = page.waitForResponse(
    (answer) => answer.url() === apiOrigin + "/v1/auth/desktop/callback",
  );
  await page.goto(`${landing}#grant=${unknownGrant()}`);
  const answer = await refused;
  expect(answer.status()).toBe(failureFor("desktop-grant-invalid").status);
  await expectFailed(page, "This sign-in has expired");
  await expectReference(page, answer.headers()["x-request-id"]);
  expect(exchanges()).toBe(1);
  expect(await keptVerifier(page)).toBeNull();

  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/sign-in");
});

test("a landing without its verifier sends nothing", async ({ page }) => {
  const exchanges = countExchanges(page);
  // A window that is signed out has nothing to resume, so its sign-in expired.
  await page.goto(`${landing}#grant=${unknownGrant()}`);
  await expectFailed(page, "This sign-in has expired");
  await expect(page.locator("details")).toHaveCount(0);

  // The verifier is taken whether or not a grant arrived, so a reload or a
  // later landing finds none.
  await open(page, "/sign-in");
  await keepVerifier(page, freshVerifier().verifier);
  await page.goto(landing);
  await expectFailed(page, "This sign-in has expired");
  await expect(page.locator("details")).toHaveCount(0);
  expect(await keptVerifier(page)).toBeNull();

  // A window that is signed in has nothing to finish, so it opens the
  // dashboard, which sends a new account on to its first workspace.
  await signIn(page, freshEmail("desktop-landing-signed-in"));
  await page.goto(`${landing}#grant=${unknownGrant()}`);
  await page.waitForURL((url) => url.pathname === "/new");
  expect(exchanges()).toBe(0);
});

test("any other failure says the window couldn't sign in, with its reference", async ({
  page,
}) => {
  await open(page, "/sign-in");
  await keepVerifier(page, freshVerifier().verifier);
  await failWith(page, "**/v1/auth/desktop/callback", "POST", "internal-error");
  await page.goto(`${landing}#grant=${unknownGrant()}`);
  await expectFailed(page, "We couldn’t sign you in");
  // The reference every routed failure of the harness carries.
  await expectReference(page, "01994f10-0000-7000-8000-0000000000bb");
});

test("a session read that fails while the landing waits offers to read it again", async ({
  page,
}) => {
  await failWith(page, "**/v1/session", "GET", "unavailable");
  await page.goto(`${landing}#grant=${unknownGrant()}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Mokly couldn’t load" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(1);
  await page.unroute("**/v1/session");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "This sign-in has expired" }),
  ).toBeVisible();
});
