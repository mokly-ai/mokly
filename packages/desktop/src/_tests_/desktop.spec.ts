import { rmSync } from "node:fs";

import { test, expect } from "@playwright/test";
import type { ElectronApplication } from "@playwright/test";

import {
  codeVerifier,
  flowKeys,
  githubState,
  seedFlow,
  storedFlow,
} from "../../../app/src/_tests_/auth-callbacks";
import {
  freshVerifier,
  keepVerifier,
  keptVerifier,
} from "../../../app/src/_tests_/desktop-sign-in";
import { freshEmail, ready } from "../../../app/src/_tests_/harness";
import { apiOrigin, appOrigin } from "../../../app/src/_tests_/origins";
import { DESKTOP_ORIGIN } from "../origin.js";

import { expectShareClipboard } from "./clipboard";
import { browserGrant, launchHandoff, startSignIn } from "./desktop-sign-in";
import {
  captureOpener,
  deliverHandoff,
  expectSafeNavigationDiagnostic,
  follow,
  launch,
  opened,
  profileDirectory,
  screenshot,
  signedInEmail,
} from "./shell";
import { viewerProof } from "./viewer";

test("the bundled shell keeps its origin, session, navigation and catalogue boundary", async ({
  page: browser,
}) => {
  const profile = profileDirectory("profile");
  let electron: ElectronApplication | undefined;
  try {
    electron = await launch(profile);
    let page = await electron.firstWindow();
    await expect(
      page.getByRole("button", { name: "Continue in browser" }),
    ).toBeVisible();
    await page.goto(DESKTOP_ORIGIN + "/sign-up?returnTo=%2Fnew");
    const { connect, verifier } = await startSignIn(electron, page);
    const email = freshEmail("electron");
    const grant = await browserGrant(browser, email, connect);
    const exchanged = page.waitForResponse(
      (response) =>
        response.url() === apiOrigin + "/v1/auth/desktop/callback" &&
        response.request().method() === "POST",
    );
    await launchHandoff(
      electron,
      profile,
      `mokly://auth/desktop/callback#grant=${grant}`,
    );
    const requested = await exchanged;
    expect(requested.status()).toBe(200);
    expect((await requested.request().allHeaders()).origin).toBe(
      DESKTOP_ORIGIN,
    );
    expect(requested.headers()["access-control-allow-origin"]).toBe(
      DESKTOP_ORIGIN,
    );
    await page.waitForURL(DESKTOP_ORIGIN + "/new");
    expect(await keptVerifier(page)).toBeNull();
    const history = await electron.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]
        .webContents.navigationHistory.getAllEntries()
        .map((entry) => new URL(entry.url).pathname),
    );
    expect(history).not.toContain("/auth/desktop/callback");
    await ready(page);
    expect(await signedInEmail(page, apiOrigin)).toBe(email);
    const cookies = await electron.context().cookies(apiOrigin);
    const session = cookies.find((cookie) =>
      cookie.name.endsWith("mkc_session"),
    );
    expect(session?.sameSite).toBe("None");
    expect(session?.secure).toBe(true);
    expect(session?.httpOnly).toBe(true);
    await screenshot(page, "signed-in");
    await electron.close();
    electron = undefined;
    electron = await launch(profile);
    page = await electron.firstWindow();
    await ready(page);
    expect(await signedInEmail(page, apiOrigin)).toBe(email);

    await page.waitForURL(DESKTOP_ORIGIN + "/new");

    const recoveryEmail = freshEmail("electron-recovery");
    await keepVerifier(page, verifier);
    const refused = page.waitForResponse(
      (response) =>
        response.url() === apiOrigin + "/v1/auth/desktop/callback" &&
        response.request().method() === "POST",
    );
    await deliverHandoff(
      electron,
      `mokly://auth/desktop/callback#grant=${grant}`,
    );
    const rejection = await refused;
    expect(rejection.status()).toBe(400);
    expect(await rejection.json()).toMatchObject({
      error: { reason: "desktop-grant-invalid" },
    });
    await expect(
      page.getByRole("heading", {
        name: "This sign-in has expired",
        exact: true,
      }),
    ).toBeVisible();
    expect(page.url()).toBe(DESKTOP_ORIGIN + "/auth/desktop/callback");
    await page.evaluate(() => {
      Object.assign(globalThis, { desktopHandoffDocument: true });
    });
    // The failed landing consumes its verifier. Arrange the next sign-in without leaving it.
    const recovery = freshVerifier();
    await keepVerifier(page, recovery.verifier);
    const recoveryConnect = new URL(connect);
    recoveryConnect.searchParams.set("challenge", recovery.challenge);
    const recoveryGrant = await browserGrant(
      browser,
      recoveryEmail,
      recoveryConnect,
    );
    await deliverHandoff(
      electron,
      `mokly://auth/desktop/callback#grant=${recoveryGrant}`,
    );
    await page.waitForURL(DESKTOP_ORIGIN + "/new");
    expect(await signedInEmail(page, apiOrigin)).toBe(recoveryEmail);
    expect(
      await page.evaluate(() => "desktopHandoffDocument" in globalThis),
    ).toBe(false);

    const projectPath = await viewerProof(page);
    await expectShareClipboard(electron, page);
    await captureOpener(electron);
    await follow(page, appOrigin + projectPath + "?viewport=mobile");
    await page.waitForURL(DESKTOP_ORIGIN + projectPath + "?viewport=mobile");
    await expect(page.getByTestId("viewer-share")).toBeVisible();
    await screenshot(page, "share-address");
    await follow(page, appOrigin + "/docs/publish");
    await follow(page, "https://example.com/review", true);
    await follow(page, "https://github.com/login");
    await follow(page, "https://checkout.stripe.com/desktop-test");
    await expect
      .poll(() => opened(electron!))
      .toEqual([
        appOrigin + "/docs/publish",
        "https://example.com/review",
        "https://github.com/login",
        "https://checkout.stripe.com/desktop-test",
      ]);
    expect(await electron.windows()).toHaveLength(1);

    await seedFlow(page, flowKeys.signIn);
    let providerExchanged = false;
    let hostedRequests = 0;
    await page.route(appOrigin + "/auth/github/callback**", (route) => {
      hostedRequests++;
      return route.abort();
    });
    await page.route(apiOrigin + "/v1/auth/github/callback", async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        code: "provider-code",
        state: githubState,
        codeVerifier,
      });
      expect(new URL(page.url()).search).toBe("");
      providerExchanged = true;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "unavailable",
            reason: "operation-unavailable",
            message: "Unavailable",
            request_id: "desktop-provider",
          },
        }),
      });
    });
    await follow(
      page,
      `${appOrigin}/auth/github/callback?code=provider-code&state=${githubState}`,
    );
    await expect(
      page.getByRole("heading", { name: "GitHub sign-in opens soon" }),
    ).toBeVisible();
    expect(providerExchanged).toBe(true);
    expect(hostedRequests).toBe(0);
    expect(page.url()).toBe(DESKTOP_ORIGIN + "/auth/github/callback");
    expect(await storedFlow(page, flowKeys.signIn)).toBeNull();
    await expectSafeNavigationDiagnostic(electron);
  } finally {
    await electron?.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
