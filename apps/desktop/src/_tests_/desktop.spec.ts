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
import { freshEmail, ready } from "../../../app/src/_tests_/harness";
import { apiOrigin, appOrigin } from "../../../app/src/_tests_/origins";
import { mailedLink } from "../../../app/src/_tests_/sign-in-links";
import { DESKTOP_ORIGIN } from "../origin.js";

import { expectShareClipboard } from "./clipboard";
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
    await expect(page.getByTestId("email-entry")).toBeVisible();
    await page.goto(DESKTOP_ORIGIN + "/sign-up");
    const email = freshEmail("electron");
    await page.getByLabel("Email").fill(email);
    const sent = page.waitForResponse(apiOrigin + "/v1/auth/magic-links");
    await page.getByTestId("email-entry").click();
    const requested = await sent;
    expect(requested.status()).toBe(202);
    expect((await requested.request().allHeaders()).origin).toBe(
      DESKTOP_ORIGIN,
    );
    expect(requested.headers()["access-control-allow-origin"]).toBe(
      DESKTOP_ORIGIN,
    );
    const link = await mailedLink(email);
    expect(new URL(link).search).toBe("?client=desktop");
    await browser.goto(link);
    await expect(
      browser.getByRole("button", { name: "Open Mokly" }),
    ).toBeVisible();
    await screenshot(browser, "browser-handoff");
    const token = new URLSearchParams(new URL(link).hash.slice(1)).get(
      "token",
    )!;
    await electron.close();
    electron = undefined;
    electron = await launch(
      profile,
      `mokly://auth/email/callback#token=${token}`,
    );
    page = await electron.firstWindow();
    await page.waitForURL(DESKTOP_ORIGIN + "/new");
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
    await page.evaluate(
      async ({ origin, email }) => {
        const response = await fetch(origin + "/v1/auth/magic-links", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (response.status !== 202)
          throw new Error(`link issue failed: ${response.status}`);
      },
      { origin: apiOrigin, email: recoveryEmail },
    );
    const recoveryLink = await mailedLink(recoveryEmail);
    await deliverHandoff(
      electron,
      `mokly://auth/email/callback#token=${token}`,
    );
    await expect(
      page.getByRole("heading", {
        name: "This link has already been used",
        exact: true,
      }),
    ).toBeVisible();
    expect(page.url()).toBe(DESKTOP_ORIGIN + "/auth/email/callback");
    await page.evaluate(() => {
      Object.assign(globalThis, { desktopHandoffDocument: true });
    });
    await deliverHandoff(
      electron,
      "mokly://auth/email/callback" + new URL(recoveryLink).hash,
    );
    await page.waitForURL(DESKTOP_ORIGIN + "/new");
    expect(await signedInEmail(page, apiOrigin)).toBe(recoveryEmail);
    expect(
      await page.evaluate(() => "desktopHandoffDocument" in globalThis),
    ).toBe(false);

    // The in-shell landing ignores the browser-only handoff query.
    const secondEmail = freshEmail("electron-query");
    await page.evaluate(
      async ({ origin, email }) => {
        const response = await fetch(origin + "/v1/auth/magic-links", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (response.status !== 202)
          throw new Error(`link issue failed: ${response.status}`);
      },
      { origin: apiOrigin, email: secondEmail },
    );
    const queryLink = await mailedLink(secondEmail);
    await page.goto(
      DESKTOP_ORIGIN +
        "/auth/email/callback?client=desktop" +
        new URL(queryLink).hash,
    );
    await page.waitForURL(DESKTOP_ORIGIN + "/new");
    expect(await signedInEmail(page, apiOrigin)).toBe(secondEmail);

    const projectPath = await viewerProof(page);
    await expectShareClipboard(electron, page);
    await captureOpener(electron);
    await follow(page, appOrigin + projectPath + "?viewport=mobile");
    await page.waitForURL(DESKTOP_ORIGIN + projectPath + "?viewport=mobile");
    await expect(page.getByTestId("viewer-share")).toBeVisible();
    await screenshot(page, "share-address");
    await follow(page, appOrigin + "/docs/publish");
    await follow(page, "https://example.com/review", true);
    await expect
      .poll(() => opened(electron!))
      .toEqual([appOrigin + "/docs/publish", "https://example.com/review"]);
    expect(await electron.windows()).toHaveLength(1);

    await seedFlow(page, flowKeys.signIn);
    let exchanged = false;
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
      exchanged = true;
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
    await page.route("https://github.com/desktop-test", (route) =>
      route.fulfill({
        status: 302,
        headers: {
          Location: `${appOrigin}/auth/github/callback?code=provider-code&state=${githubState}`,
        },
      }),
    );
    await follow(page, "https://github.com/desktop-test");
    await expect(
      page.getByRole("heading", { name: "GitHub sign-in opens soon" }),
    ).toBeVisible();
    expect(exchanged).toBe(true);
    expect(hostedRequests).toBe(0);
    expect(page.url()).toBe(DESKTOP_ORIGIN + "/auth/github/callback");
    expect(await storedFlow(page, flowKeys.signIn)).toBeNull();
    await expectSafeNavigationDiagnostic(electron);
  } finally {
    await electron?.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
