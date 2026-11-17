import type { ApiReason } from "../api/reasons";
import {
  callbackUrl,
  connection,
  flowKeys,
  githubState,
  installUrl,
  json,
  otherState,
  routeSignedInSession,
  seedFlow,
  session,
  storedFlow,
} from "./auth-callbacks";
import { apiFailure, expect, open, ready, test } from "./harness";
import { githubOrigin } from "./origins";

test("the installation landing rejects missing and mismatched local state", async ({
  page,
}) => {
  let requests = 0;
  await routeSignedInSession(page);
  await page.route("**/v1/github/installations/callback", (route) => {
    requests += 1;
    return json(route, connection(callbackUrl()));
  });

  await open(page, "/auth/github/install");
  await expect(
    page.getByRole("heading", { level: 1, name: "Installation expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Installation expired" }),
  ).toHaveCount(0);
  expect(
    await page.locator('meta[name="referrer"]').getAttribute("content"),
  ).toBe("no-referrer");
  expect(new URL(page.url()).search).toBe("");

  await seedFlow(page, flowKeys.installSetup);
  await page.goto(installUrl(otherState).replace(/^https?:\/\/[^/]+/, ""));
  await ready(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Installation expired" }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(await storedFlow(page, flowKeys.installSetup)).toBeNull();
  expect(requests).toBe(0);
});

test("a session startup failure keeps installation pending", async ({
  page,
}) => {
  let sessionReads = 0;
  let callbacks = 0;
  await page.route("**/v1/session", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    sessionReads += 1;
    if (sessionReads <= 2) {
      const failure = apiFailure("internal-error");
      return route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: failure.body,
      });
    }
    return json(route, session());
  });
  await page.route("**/v1/github/installations/callback", (route) => {
    callbacks += 1;
    return json(route, connection("/sign-in"));
  });

  await open(page, "/sign-in");
  await expect.poll(() => sessionReads).toBe(1);
  await seedFlow(page, flowKeys.installSetup);
  await page.goto(installUrl().replace(/^https?:\/\/[^/]+/, ""));
  await ready(page);

  const retry = page.getByRole("button", { name: "Try again" });
  await expect(retry).toBeVisible();
  expect(callbacks).toBe(0);
  expect(await storedFlow(page, flowKeys.installSetup)).toBeNull();
  const completed = page.waitForResponse((response) =>
    response.url().endsWith("/v1/github/installations/callback"),
  );
  await retry.click();
  await completed;
  expect(sessionReads).toBe(3);
  expect(callbacks).toBe(1);
});

const refusals: readonly { reason: ApiReason; title: string }[] = [
  { reason: "github-auth-invalid", title: "Installation expired" },
  {
    reason: "operation-unavailable",
    title: "GitHub installation opens soon",
  },
  { reason: "internal-error", title: "Installation wasn’t completed" },
];

test("the installation landing maps every registered refusal", async ({
  page,
}) => {
  let reason: ApiReason = "github-auth-invalid";
  await routeSignedInSession(page);
  await page.route("**/v1/github/installations/callback", (route) => {
    const failure = apiFailure(reason);
    return route.fulfill({
      status: failure.status,
      contentType: "application/json",
      body: failure.body,
    });
  });
  await open(page, "/sign-in");

  for (const refusal of refusals) {
    reason = refusal.reason;
    await seedFlow(page, flowKeys.installSetup);
    await page.goto(installUrl().replace(/^https?:\/\/[^/]+/, ""));
    await ready(page);
    await expect(
      page.getByRole("heading", { level: 1, name: refusal.title }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back to install" }),
    ).toBeVisible();
    expect(new URL(page.url()).search).toBe("");
    expect(await storedFlow(page, flowKeys.installSetup)).toBeNull();
  }
});

test("a request waiting for approval says who finishes it and sends nothing", async ({
  page,
}) => {
  let requests = 0;
  await routeSignedInSession(page);
  await page.route("**/v1/github/installations/callback", (route) => {
    requests += 1;
    return json(route, connection(callbackUrl()));
  });
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.installSetup);
  await page.goto(
    `/auth/github/install?setup_action=request&state=${githubState}`,
  );
  await ready(page);

  await expect(
    page.getByRole("heading", { level: 1, name: "Installation requested" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "An owner of the GitHub organization approves it on GitHub.",
    ),
  ).toBeVisible();
  // Nothing failed, so there is no alert and no reference.
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(new URL(page.url()).search).toBe("");
  expect(await storedFlow(page, flowKeys.installSetup)).toBeNull();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Back to install" }).click();
  await page.waitForURL((url) => url.pathname === "/install");
});

test("a landing the browser restores after it left offers the way back", async ({
  page,
}) => {
  await routeSignedInSession(page);
  await page.route("**/v1/github/installations/callback", (route) =>
    json(route, connection(`${githubOrigin}/login/oauth/authorize`)),
  );
  // The browser defers every read of a page whose navigation is pending, so
  // the trip to GitHub is answered with 204 No Content, which keeps the
  // landing exactly as it was while it left.
  const trips: string[] = [];
  await page.route(`${githubOrigin}/**`, (route) => {
    trips.push(route.request().url());
    return route.fulfill({ status: 204 });
  });
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.installSetup);
  await page.goto(installUrl().replace(/^https?:\/\/[^/]+/, ""));
  await ready(page);
  await expect.poll(() => trips.length).toBe(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Completing installation…" }),
    "the landing waits until the page has left",
  ).toBeVisible();

  // Playwright runs Chromium without its back-forward cache, so the test
  // sends the event that the browser sends when it restores a page from it.
  // The landing's input is used, so it is the landing reached again.
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Installation expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to install" }),
  ).toBeVisible();
});
