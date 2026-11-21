import { apiFailure } from "./api-responses";
import {
  callbackUrl,
  connection,
  flowKeys,
  githubState,
  issued,
  json,
  routeSignedInSession,
  seedFlow,
  session,
  storedFlow,
} from "./auth-callbacks";
import {
  expect,
  freshEmail,
  open,
  openDialog,
  ready,
  signIn,
  test,
} from "./harness";

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
