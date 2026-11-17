import type { ApiReason } from "../api/reasons";

import {
  callbackUrl,
  connection,
  flowKeys,
  githubState,
  issued,
  json,
  otherState,
  routeSignedInSession,
  seedFlow,
  session,
  storedFlow,
} from "./auth-callbacks";
import {
  apiFailure,
  expect,
  freshEmail,
  open,
  openDialog,
  ready,
  signIn,
  test,
} from "./harness";

test("GitHub sign-in preserves an encoded destination through its callback", async ({
  page,
}) => {
  const destination =
    "/new?selection=one%26two+literal%2Bplus%23notes" +
    "&branch=%C3%A9quipe%2F%E6%9D%B1%E4%BA%AC&tag=first&tag=second";
  let cleanedAtExchange = false;
  let exchanged = false;
  await page.route("**/v1/session", (route) => {
    if (route.request().method() !== "GET" || !exchanged) {
      return route.continue();
    }
    return json(route, session("csrf-rotated"));
  });
  await page.route("**/v1/auth/github", (route) => {
    expect(route.request().postDataJSON()).toEqual({ returnTo: destination });
    return json(route, connection(callbackUrl()));
  });
  await page.route("**/v1/auth/github/callback", (route) => {
    cleanedAtExchange = new URL(page.url()).search === "";
    expect(route.request().postDataJSON()).toEqual({
      code: "provider-code",
      state: githubState,
      codeVerifier: "c".repeat(64),
    });
    expect(route.request().headers()["x-csrf-token"]).toBeUndefined();
    exchanged = true;
    return json(route, issued(destination));
  });

  await open(page, `/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByTestId("github-entry").click();
  await page.waitForURL((url) => url.pathname === "/new");
  await ready(page);

  expect(cleanedAtExchange).toBe(true);
  const returned = new URL(page.url());
  expect(returned.pathname + returned.search).toBe(destination);
  expect(returned.searchParams.get("selection")).toBe(
    "one&two literal+plus#notes",
  );
  expect(returned.searchParams.get("branch")).toBe("équipe/東京");
  expect(returned.searchParams.getAll("tag")).toEqual(["first", "second"]);
  expect(await storedFlow(page, flowKeys.signIn)).toBeNull();
});

test("the GitHub callback rejects missing and mismatched local state", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/v1/auth/github/callback", (route) => {
    requests += 1;
    return json(route, issued("/dashboard"));
  });

  await open(page, "/auth/github/callback");
  await expect(
    page.getByRole("heading", { level: 1, name: "GitHub sign-in expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "GitHub sign-in expired" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();
  expect(
    await page.locator('meta[name="referrer"]').getAttribute("content"),
  ).toBe("no-referrer");
  expect(new URL(page.url()).search).toBe("");

  await seedFlow(page, flowKeys.signIn);
  await page.goto(
    `/auth/github/callback?code=provider-code&state=${otherState}`,
  );
  await ready(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "GitHub sign-in expired" }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(await storedFlow(page, flowKeys.signIn)).toBeNull();
  expect(requests).toBe(0);
});

test("a refused connection keeps its callback purpose", async ({ page }) => {
  let requests = 0;
  await routeSignedInSession(page);
  await page.route("**/v1/auth/github/callback", (route) => {
    requests += 1;
    return json(route, issued("/dashboard"));
  });
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.connect);
  await page.goto(
    `/auth/github/callback?error=access_denied&state=${githubState}`,
  );
  await ready(page);

  await expect(
    page.getByRole("heading", { level: 1, name: "GitHub sign-in expired" }),
  ).toBeVisible();
  const recovery = page.getByRole("button", { name: "Back to sign in" });
  await expect(recovery).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(await storedFlow(page, flowKeys.connect)).toBeNull();
  expect(requests).toBe(0);
  await recovery.click();
  // The account pane is a full-screen route on a compact surface and the
  // dialog over the reader's own page on a wide one, so either address is the
  // pane.
  await page.waitForURL(
    (url) =>
      url.pathname === "/settings/account" ||
      url.searchParams.get("settings") === "account",
  );
});

test("a refused installation authorization returns to installation", async ({
  page,
}) => {
  let requests = 0;
  await routeSignedInSession(page);
  await page.route("**/v1/auth/github/callback", (route) => {
    requests += 1;
    return json(route, issued("/dashboard"));
  });
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.installAuthorize);
  await page.goto(
    `/auth/github/callback?error=access_denied&state=${githubState}`,
  );
  await ready(page);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Installation wasn’t completed",
    }),
  ).toBeVisible();
  const recovery = page.getByRole("button", { name: "Back to install" });
  await expect(recovery).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(await storedFlow(page, flowKeys.installAuthorize)).toBeNull();
  expect(requests).toBe(0);
  await recovery.click();
  await page.waitForURL((url) => url.pathname === "/install");
});

test("a refused sign-in returns to account entry", async ({ page }) => {
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.signIn);
  await page.goto(
    `/auth/github/callback?error=access_denied&state=${githubState}`,
  );
  await ready(page);

  const recovery = page.getByRole("button", { name: "Back to sign in" });
  await expect(recovery).toBeVisible();
  await recovery.click();
  await page.waitForURL((url) => url.pathname === "/sign-in");
});

const refusals: readonly {
  reason: ApiReason;
  title: string;
  action: string;
}[] = [
  {
    reason: "github-auth-invalid",
    title: "GitHub sign-in expired",
    action: "Back to sign in",
  },
  {
    reason: "github-identity-conflict",
    title: "This GitHub account is connected to another Mokly account",
    action: "Back to sign in",
  },
  {
    reason: "operation-unavailable",
    title: "GitHub sign-in opens soon",
    action: "Continue with email",
  },
  {
    reason: "internal-error",
    title: "GitHub sign-in failed",
    action: "Back to sign in",
  },
];

test("the GitHub callback maps every registered refusal", async ({ page }) => {
  let reason: ApiReason = "github-auth-invalid";
  await page.route("**/v1/auth/github/callback", (route) => {
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
    await seedFlow(page, flowKeys.signIn);
    await page.goto(callbackUrl().replace(/^https?:\/\/[^/]+/, ""));
    await ready(page);
    await expect(
      page.getByRole("heading", { level: 1, name: refusal.title }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: refusal.action }),
    ).toBeVisible();
    expect(new URL(page.url()).search).toBe("");
    expect(await storedFlow(page, flowKeys.signIn)).toBeNull();
  }
});

test("a connection identity conflict returns to account settings", async ({
  page,
}) => {
  await routeSignedInSession(page);
  await page.route("**/v1/auth/github/callback", (route) => {
    const failure = apiFailure("github-identity-conflict");
    return route.fulfill({
      status: failure.status,
      contentType: "application/json",
      body: failure.body,
    });
  });
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.connect);
  await page.goto(callbackUrl().replace(/^https?:\/\/[^/]+/, ""));
  await ready(page);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "This GitHub account is connected to another Mokly account",
    }),
  ).toBeVisible();
  const recovery = page.getByRole("button", { name: "Back to account" });
  await expect(recovery).toBeVisible();
  await recovery.click();
  await page.waitForURL(
    (url) =>
      url.pathname === "/settings/account" ||
      url.searchParams.get("settings") === "account",
  );
});

test("a signed-in GitHub connection sends the initiating CSRF token", async ({
  page,
}) => {
  // The account pane is the one place that starts a signed-in connection, and
  // it stores its own address, so a connection that succeeds returns the
  // reader to the pane they pressed it on.
  await signIn(page, freshEmail("connect-csrf"));
  await page.waitForURL((url) => url.pathname === "/new");
  const pane = "/new?settings=account";

  // The token the session held when the trip began, which the rotated one the
  // exchange answers with must not replace before the exchange is sent.
  let initiating: string | undefined;
  await page.route("**/v1/github/connection", (route) => {
    expect(route.request().postDataJSON()).toEqual({ returnTo: pane });
    initiating = route.request().headers()["x-csrf-token"];
    expect(initiating, "the connection is session-bound").toBeTruthy();
    return json(route, connection(callbackUrl()));
  });
  await page.route("**/v1/auth/github/callback", (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe(initiating);
    return json(route, issued(pane));
  });

  await openDialog(page, "/settings/account");
  expect(page.url()).toContain(pane);
  const exchanged = page.waitForResponse((response) =>
    response.url().endsWith("/v1/auth/github/callback"),
  );
  await page.getByTestId("settings-connect-github").click();
  await exchanged;
  await page.waitForURL(
    (url) =>
      url.pathname === "/new" && url.searchParams.get("settings") === "account",
  );
  await ready(page);
  expect(await storedFlow(page, flowKeys.connect)).toBeNull();
});

test("a session startup failure keeps the connection pending", async ({
  page,
}) => {
  let sessionReads = 0;
  let exchanges = 0;
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
  await page.route("**/v1/auth/github/callback", (route) => {
    exchanges += 1;
    return json(route, issued("/new"));
  });

  await open(page, "/sign-in");
  await expect.poll(() => sessionReads).toBe(1);
  await seedFlow(page, flowKeys.connect);
  await page.goto(callbackUrl().replace(/^https?:\/\/[^/]+/, ""));
  await ready(page);

  const retry = page.getByRole("button", { name: "Try again" });
  await expect(retry).toBeVisible();
  expect(exchanges).toBe(0);
  expect(await storedFlow(page, flowKeys.connect)).toBeNull();
  await retry.click();
  await page.waitForURL((url) => url.pathname === "/new");
  expect(sessionReads).toBe(3);
  expect(exchanges).toBe(1);
});

test("a final installation authorization recovers through the install screen", async ({
  page,
}) => {
  await routeSignedInSession(page);
  await page.route("**/v1/auth/github/callback", (route) => {
    const failure = apiFailure("internal-error");
    return route.fulfill({
      status: failure.status,
      contentType: "application/json",
      body: failure.body,
    });
  });
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.installAuthorize);
  await page.goto(callbackUrl().replace(/^https?:\/\/[^/]+/, ""));
  await ready(page);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Installation wasn’t completed",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to install" }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(await storedFlow(page, flowKeys.installAuthorize)).toBeNull();
});
