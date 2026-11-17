import type { APIRequestContext, Page } from "@playwright/test";

import { recordAddresses, recordedAddresses } from "./address-log";
import { fixtureDesktopOrigin } from "./desktop-fixture";
import { stateDocumentViolations } from "./document-policy";
import { expect, freshEmail, navigateMagicLink, ready } from "./harness";
import { apiOrigin, appOrigin } from "./origins";
import { expectScreenPolicy } from "./screen-policy";
import { admitLinkRequest, mailedLink } from "./sign-in-links";

/** The screen the email landing draws for a link the desktop app requested. */
const handoffScreen = '[data-mkc-screen="account-callback-desktop"]';

/**
 * Ask the API for a sign-in link exactly as the desktop app does: from the
 * desktop origin, which a page in this browser can never send.
 */
async function requestDesktopLink(
  page: Page,
  app: APIRequestContext,
  email: string,
): Promise<string> {
  await admitLinkRequest(page, () =>
    app.post(apiOrigin + "/v1/auth/magic-links", {
      headers: { Origin: fixtureDesktopOrigin },
      data: { email },
    }),
  );
  return mailedLink(email);
}

/**
 * The token of a link in the desktop form the API issues, checked without
 * ever putting the link or the token in a test diagnostic.
 */
function desktopToken(link: string): string {
  const address = new URL(link);
  expect(address.origin, "the link opens the hosted landing").toBe(appOrigin);
  expect(address.pathname).toBe("/auth/email/callback");
  expect(address.search).toBe("?client=desktop");
  const tokens = new URLSearchParams(address.hash.slice(1)).getAll("token");
  expect(
    tokens.length === 1 && /^[0-9a-f]{64}$/.test(tokens[0]),
    "the fragment carries one 64-hex token",
  ).toBe(true);
  return tokens[0];
}

/** What the landing did, in order, with the reader's own presses among it. */
interface LandingLog {
  /** `exchange`, `scheme`, and each press a test records before making it. */
  events: string[];
  /** Every scheme navigation the page asked its own tab for, in order. */
  schemes: { url: string; disposition: string }[];
}

/**
 * Record each exchange the page sends and each navigation it asks its own tab
 * to make to the `mokly` scheme, fragment included, in one ordered log. The
 * browser hands a scheme address to the operating system and the page stays
 * where it is, so the request is all there is to observe. A test writes each
 * press into the same log before it makes it, so the order alone proves that
 * the landing does nothing until the reader asks.
 */
async function recordLanding(page: Page): Promise<LandingLog> {
  const log: LandingLog = { events: [], schemes: [] };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/v1/auth/callback") {
      log.events.push("exchange");
    }
  });
  const session = await page.context().newCDPSession(page);
  await session.send("Page.enable");
  session.on("Page.frameRequestedNavigation", (event) => {
    if (!event.url.startsWith("mokly:")) return;
    log.events.push("scheme");
    log.schemes.push({ url: event.url, disposition: event.disposition });
  });
  return log;
}

async function signedInEmail(page: Page): Promise<string> {
  return page.evaluate(async (origin) => {
    const response = await fetch(origin + "/v1/session", {
      credentials: "include",
    });
    if (!response.ok)
      throw new Error(`session read failed: ${response.status}`);
    return ((await response.json()) as { user: { email: string } }).user.email;
  }, apiOrigin);
}

/** The handoff as the catalogue draws it, holding the token out of sight. */
async function expectHandoff(page: Page, token: string): Promise<void> {
  const screen = page.locator(handoffScreen);
  await expect(screen).toBeVisible();
  await expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Finish signing in",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    screen.getByText("You requested this link from the Mokly app.", {
      exact: true,
    }),
  ).toBeVisible();
  await expectScreenPolicy(page, "the desktop handoff");
  // The heading does not name Mokly, so the tab takes it whole, with the
  // product after it.
  await expect(page).toHaveTitle("Finish signing in · Mokly");
  await expect(page.getByRole("alert")).toHaveCount(0);

  const actions = screen.locator("main").getByRole("button");
  await expect(actions).toHaveText(["Open Mokly", "Continue in browser"]);
  await expect(actions.nth(0)).toHaveAttribute("data-testid", "open-mokly");
  // The external glyph, lucide's arrow-up-right, and no glyph on the other.
  await expect(actions.nth(0).locator("svg")).toHaveCount(1);
  await expect(actions.nth(0).locator('svg path[d="M7 17 17 7"]')).toHaveCount(
    1,
  );
  await expect(actions.nth(1).locator("svg")).toHaveCount(0);
  for (const action of await actions.all()) {
    const box = await action.boundingBox();
    expect(box?.height ?? 0, "the action clears 44px").toBeGreaterThanOrEqual(
      44,
    );
  }
  const markup = await page.evaluate(() => document.documentElement.outerHTML);
  expect(markup.includes(token), "the page holds the token out of sight").toBe(
    false,
  );
}

/**
 * The browser holds the token until the reader chooses: Open Mokly asks this
 * tab for the scheme address the app accepts and the page stays, and only
 * Continue in browser exchanges the token, which signs this browser in. No
 * address the landing's document takes after it loads carries the token.
 */
export async function expectHandoffSignsIn(
  page: Page,
  app: APIRequestContext,
): Promise<void> {
  const email = freshEmail("desktop-handoff");
  const link = await requestDesktopLink(page, app, email);
  const token = desktopToken(link);
  const log = await recordLanding(page);
  await recordAddresses(page);
  await navigateMagicLink(page, link);
  await expectHandoff(page, token);
  expect(log.events, "the landing waits for the reader").toEqual([]);

  log.events.push("open");
  await page.getByRole("button", { name: "Open Mokly" }).click();
  await expect.poll(() => log.events).toEqual(["open", "scheme"]);
  expect(log.schemes[0].disposition).toBe("currentTab");
  expect(
    log.schemes[0].url === `mokly://auth/email/callback#token=${token}`,
    "Open Mokly hands this link's token to the app",
  ).toBe(true);
  await expect(page.locator(handoffScreen)).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/auth/email/callback");

  log.events.push("continue");
  await page.getByRole("button", { name: "Continue in browser" }).click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith("/auth/email/callback"),
  );
  await ready(page);
  expect(await signedInEmail(page)).toBe(email);
  expect(log.events, "each press caused its own effect, once").toEqual([
    "open",
    "scheme",
    "continue",
    "exchange",
  ]);

  const [first = "", ...later] = await recordedAddresses(page);
  expect(first.includes("#token="), "the landing loaded with its token").toBe(
    true,
  );
  expect(later.length, "the landing wrote its address").toBeGreaterThan(0);
  expect(
    later.filter((address) => address.includes("token=")).length,
    "no later address carries the token",
  ).toBe(0);
}

/**
 * The app exchanged the token first, from its own origin and cookie store, so
 * Continue in browser reports the used link and offers another one.
 */
export async function expectUsedByTheApp(
  page: Page,
  app: APIRequestContext,
): Promise<void> {
  const email = freshEmail("desktop-used");
  const link = await requestDesktopLink(page, app, email);
  const token = desktopToken(link);
  const exchanged = await app.post(apiOrigin + "/v1/auth/callback", {
    headers: { Origin: fixtureDesktopOrigin },
    data: { token },
  });
  expect(exchanged.status(), "the app's own exchange signs it in").toBe(200);

  const log = await recordLanding(page);
  await navigateMagicLink(page, link);
  await expectHandoff(page, token);
  expect(log.events, "the landing waits for the reader").toEqual([]);
  log.events.push("continue");
  await page.getByRole("button", { name: "Continue in browser" }).click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "This link has already been used",
    }),
  ).toBeVisible();
  const alert = page.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert).toContainText("Request another sign-in link");
  await expect(page.locator("main").getByRole("button")).toHaveText([
    "Back to sign in",
  ]);
  await expectScreenPolicy(page, "the used desktop link");
  expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
  expect(log.events).toEqual(["continue", "exchange"]);
}

/** A desktop link that lost its token is the ordinary missing-input recovery. */
export async function expectMissingTokenRecovery(page: Page): Promise<void> {
  const log = await recordLanding(page);
  await page.goto("/auth/email/callback?client=desktop");
  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn’t valid" }),
  ).toBeVisible();
  await expect(page.locator(handoffScreen)).toHaveCount(0);
  const alert = page.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert).toContainText("Request another sign-in link");
  await expect(page.locator("main").getByRole("button")).toHaveText([
    "Back to sign in",
  ]);
  await expectScreenPolicy(page, "the desktop link without a token");
  expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
  expect(log.events).toEqual([]);
}
