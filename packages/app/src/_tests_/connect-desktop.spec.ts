import { connectDesktopAddress } from "../navigation/desktop-sign-in";

import { apiFailure, failWith } from "./api-responses";
import {
  connectReturnTo,
  controls,
  expectConfirmation,
  externalGlyph,
  freshVerifier,
  grantOf,
  recordConnect,
  requestGrant,
  signedInAs,
} from "./desktop-sign-in";
import { stateDocumentViolations } from "./document-policy";
import { failureShape } from "./fragment";
import {
  expect,
  freshEmail,
  open,
  openMagicLink,
  signIn,
  test,
} from "./harness";
import { expectScreenPolicy } from "./screen-policy";
import { admitLinkRequest } from "./sign-in-links";

test("a signed-out browser signs in first and comes back to the same page", async ({
  page,
}) => {
  const { challenge } = freshVerifier();
  const address = connectDesktopAddress(challenge, connectReturnTo);
  const log = await recordConnect(page);
  await page.goto(address);
  await page.waitForURL((url) => url.pathname === "/sign-in");
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(address);

  const email = freshEmail("connect-signed-out");
  await page.getByLabel("Email").fill(email);
  await admitLinkRequest(page, async () => {
    const sent = page.waitForResponse((answer) =>
      answer.url().endsWith("/v1/auth/magic-links"),
    );
    await page.getByTestId("email-entry").click();
    return sent;
  });
  await page.waitForURL(/auth\/email/);
  await openMagicLink(page, email);
  const back = new URL(page.url());
  expect(back.pathname + back.search).toBe(address);
  await expectConfirmation(page, email);
  await expectScreenPolicy(page, "the connect page");
  expect(log.requests, "nothing is requested until Open Mokly").toEqual([]);
});

test("Open Mokly hands the app one grant and hands it again until it expires", async ({
  page,
}) => {
  const email = freshEmail("connect-grant");
  await signIn(page, email);
  const { challenge } = freshVerifier();
  const log = await recordConnect(page);
  await open(page, connectDesktopAddress(challenge, connectReturnTo));
  await expectConfirmation(page, email);
  // The tab names the page once, and the product once after it.
  await expect(page).toHaveTitle("Sign in to the app · Mokly");
  expect(log.requests, "the page loads without a grant").toEqual([]);

  const expiresAt = await requestGrant(page);
  expect(log.requests.map((request) => request.postDataJSON())).toEqual([
    { challenge, returnTo: connectReturnTo },
  ]);
  await expect.poll(() => log.schemes.length).toBe(1);
  expect(log.schemes[0].disposition).toBe("currentTab");
  const grant = grantOf(log.schemes[0].url);
  await expect(
    page.getByRole("heading", { level: 1, name: "Continue in the Mokly app" }),
  ).toBeVisible();
  await expect(page.locator(".fo-account-detail")).toHaveCount(0);
  await expect(controls(page)).toHaveText(["Open Mokly"]);
  expect(new URL(page.url()).pathname).toBe("/connect/desktop");
  await expectScreenPolicy(page, "the opened connect page");
  const markup = await page.evaluate(() => document.documentElement.outerHTML);
  expect(markup.includes(grant), "no part of the page holds the grant").toBe(
    false,
  );

  // A second press hands over the same grant, so the shell ignores it.
  await page.getByTestId("open-mokly").click();
  await expect.poll(() => log.schemes.length).toBe(2);
  expect(log.schemes[1].url === log.schemes[0].url).toBe(true);
  expect(log.requests).toHaveLength(1);

  // Once the grant has expired, the next press asks for a new one.
  await page.clock.setSystemTime(expiresAt + 1_000);
  await requestGrant(page);
  await expect.poll(() => log.schemes.length).toBe(3);
  expect(log.requests).toHaveLength(2);
  expect(grantOf(log.schemes[2].url) === grant, "a new grant").toBe(false);
  await expect(controls(page)).toHaveText(["Open Mokly"]);
});

test("Use another account signs the browser out and returns to sign in", async ({
  page,
}) => {
  const email = freshEmail("connect-another");
  await signIn(page, email);
  const { challenge } = freshVerifier();
  const address = connectDesktopAddress(challenge, connectReturnTo);
  await open(page, address);
  await expectConfirmation(page, email);
  await page.getByTestId("use-another-account").click();
  await page.waitForURL((url) => url.pathname === "/sign-in");
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(address);
  await expect(page.getByLabel("Email")).toBeVisible();
  expect(await signedInAs(page)).toBe(401);
});

test("a link without one valid challenge sends nothing and asks nobody to sign in", async ({
  page,
}) => {
  const log = await recordConnect(page);
  const { challenge } = freshVerifier();
  const invalid = [
    "/connect/desktop?returnTo=%2Fdashboard",
    "/connect/desktop?challenge=" + challenge.slice(1),
    `/connect/desktop?challenge=${challenge}&challenge=${challenge}`,
  ];
  const expectInvalid = async (address: string) => {
    await open(page, address);
    await expect(
      page.getByRole("heading", { level: 1, name: "This link isn’t valid" }),
    ).toBeVisible();
    const alert = page.getByRole("alert");
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText("Sign in again from the Mokly app.");
    await expect(controls(page)).toHaveCount(0);
    await expect(page.locator("details")).toHaveCount(0);
    expect(new URL(page.url()).pathname, address).toBe("/connect/desktop");
    await expectScreenPolicy(page, address);
    expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
  };
  for (const address of invalid) await expectInvalid(address);

  // Signed in, the header names the reader, and the link is still invalid.
  const email = freshEmail("connect-invalid");
  await signIn(page, email);
  for (const address of invalid) {
    await expectInvalid(address);
    await expect(page.locator(".fo-account-header")).toContainText(email);
  }
  expect(log.requests).toEqual([]);
});

test("a refused grant request is reported beside Open Mokly, which tries again", async ({
  page,
}) => {
  const email = freshEmail("connect-refused");
  await signIn(page, email);
  const { challenge } = freshVerifier();
  const log = await recordConnect(page);
  await open(page, connectDesktopAddress(challenge, connectReturnTo));
  await expectConfirmation(page, email);

  // Held open, so the page can be read while its request runs.
  let release: () => void = () => undefined;
  const held = new Promise<void>((done) => {
    release = done;
  });
  const busy = apiFailure("unavailable");
  await page.route("**/v1/auth/desktop/grants", async (route) => {
    await held;
    await route.fulfill({ ...busy, contentType: "application/json" });
  });
  const control = page.getByTestId("open-mokly");
  await control.click();
  // The pressed control carries the wait: its working word and the busy
  // spinner in its glyph's place, enabled so it keeps its focus, and a second
  // press sends nothing. Nothing is inserted beside it.
  await expect(controls(page)).toHaveText(["Opening…", "Use another account"]);
  await expect(control, "the busy spinner").toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(control, "a busy control stays enabled").toBeEnabled();
  await control.click();
  await expect(page.getByTestId("use-another-account")).toBeEnabled();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Opening Mokly…",
  );
  await expect(page.locator(".fo-wait"), "nothing is inserted").toHaveCount(0);
  release();

  await expect(page.getByRole("alert")).toHaveText(
    "Mokly is busy. Try again in a moment.",
  );
  await expect(controls(page)).toHaveText(["Try again", "Use another account"]);
  await expect(externalGlyph(page)).toHaveCount(1);
  await expect(page.getByTestId("use-another-account")).toBeEnabled();
  expect(await failureShape(page, "open-mokly")).toEqual({
    causeAbove: true,
    references: 1,
    detailsBelow: true,
  });
  await page.locator("summary", { hasText: "Details" }).click();
  await expect(page.locator("details")).toContainText(
    "01994f10-0000-7000-8000-0000000000bb",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Sign in to the Mokly app" }),
  ).toBeVisible();
  expect(log.schemes).toEqual([]);
  expect(log.requests, "the busy press sent nothing").toHaveLength(1);

  await page.unroute("**/v1/auth/desktop/grants");
  await requestGrant(page);
  await expect.poll(() => log.schemes.length).toBe(1);
  await expect(controls(page)).toHaveText(["Open Mokly"]);
});

test("a challenge the API refuses shows the invalid link", async ({ page }) => {
  const email = freshEmail("connect-grant-invalid");
  await signIn(page, email);
  const { challenge } = freshVerifier();
  const log = await recordConnect(page);
  await open(page, connectDesktopAddress(challenge, connectReturnTo));
  await failWith(
    page,
    "**/v1/auth/desktop/grants",
    "POST",
    "desktop-grant-invalid",
  );
  await page.getByTestId("open-mokly").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn’t valid" }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Sign in again from the Mokly app.",
  );
  await expect(controls(page)).toHaveCount(0);
  await expect(page.locator("details")).toHaveCount(0);
  await expect(page.locator(".fo-account-header")).toContainText(email);
  expect(log.schemes).toEqual([]);
});
