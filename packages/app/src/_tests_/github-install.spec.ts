import type { Workspace } from "../api/types";

import {
  callbackUrl,
  codeVerifier,
  connection,
  flowKeys,
  githubState,
  installUrl,
  issued,
  json,
  otherState,
  workspaceId,
  routeSignedInSession,
  seedFlow,
  storedFlow,
} from "./auth-callbacks";
import type { ApiBody } from "./harness";
import { expect, open, ready, test } from "./harness";

function workspace(): Workspace {
  return {
    id: workspaceId,
    name: "Callback Org",
    slug: "callback-org",
    role: "owner",
    plan: "free",
    githubInstallationState: "absent",
    version: 1,
  } satisfies Workspace;
}

async function routeWorkspaces(page: Parameters<typeof open>[0]) {
  await page.route("**/v1/workspaces**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    return json(
      route,
      pathname === `/v1/workspaces/${workspaceId}`
        ? workspace()
        : ({
            items: [workspace()],
            nextCursor: null,
          } satisfies ApiBody<"listWorkspaces">),
    );
  });
}

test("GitHub App setup transitions into authorization and resumes", async ({
  page,
}) => {
  let setupUrlCleaned = false;
  let oauthUrlCleaned = false;
  await routeSignedInSession(page);
  await routeWorkspaces(page);
  await page.route("**/v1/github/installations", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    expect(route.request().postDataJSON()).toEqual({
      workspaceId,
      returnTo: `/install?workspaceId=${workspaceId}`,
    });
    return json(route, connection(installUrl()));
  });
  await page.route("**/v1/github/installations/callback", (route) => {
    setupUrlCleaned = new URL(page.url()).search === "";
    expect(route.request().headers()["x-csrf-token"]).toBe("csrf-original");
    expect(route.request().postDataJSON()).toEqual({
      installationId: 42,
      state: githubState,
      codeVerifier,
    });
    return json(route, connection(callbackUrl()));
  });
  await page.route("**/v1/auth/github/callback", (route) => {
    oauthUrlCleaned = new URL(page.url()).search === "";
    expect(route.request().headers()["x-csrf-token"]).toBe("csrf-original");
    return json(route, issued(`/install?workspaceId=${workspaceId}`));
  });

  await open(page, `/install?workspaceId=${workspaceId}`);
  const authorized = page.waitForResponse((response) =>
    response.url().endsWith("/v1/auth/github/callback"),
  );
  await page.getByTestId("install-app").click();
  await authorized;
  await page.waitForURL(
    (url) =>
      url.pathname === "/install" &&
      url.searchParams.get("workspaceId") === workspaceId,
  );
  await ready(page);

  expect(setupUrlCleaned).toBe(true);
  expect(oauthUrlCleaned).toBe(true);
  expect(await storedFlow(page, flowKeys.installSetup)).toBeNull();
  expect(await storedFlow(page, flowKeys.installAuthorize)).toBeNull();
});

// A return carries no state when it comes from Redirect on update or an
// install started on GitHub. GitHub's own pages can also keep the state of a
// setup trip that this tab no longer holds, which no landing can finish.
for (const { arrival, address, seeded } of [
  {
    arrival: "a stateless return",
    address: "/auth/github/install?installation_id=42&setup_action=update",
    seeded: false,
  },
  {
    arrival: "a return whose state this tab does not hold",
    address: installUrl(otherState).replace(/^https?:\/\/[^/]+/, ""),
    seeded: true,
  },
]) {
  test(`${arrival} opens the connect situation in the landing's place`, async ({
    page,
  }) => {
    let callbacks = 0;
    await routeSignedInSession(page);
    await routeWorkspaces(page);
    await page.route("**/v1/github/installations/callback", (route) => {
      callbacks += 1;
      return route.continue();
    });
    await open(page, "/sign-in");
    if (seeded) await seedFlow(page, flowKeys.installSetup);
    const before = await page.evaluate(() => window.history.length);
    await page.goto(address);
    await page.waitForURL(
      (url) =>
        url.pathname === "/install" &&
        url.searchParams.get("installationId") === "42",
    );
    await ready(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Connect a GitHub account" }),
    ).toBeVisible();
    await expect(page.locator(".fo-facts")).toContainText("Callback Org");
    expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
    expect(
      await page.locator('meta[name="referrer"]').getAttribute("content"),
    ).toBe("no-referrer");
    expect(callbacks).toBe(0);
  });
}

test("Continue on GitHub starts the candidate flow into authorization", async ({
  page,
}) => {
  await routeSignedInSession(page);
  await routeWorkspaces(page);
  await page.route("**/v1/github/installations", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    expect(route.request().postDataJSON()).toEqual({
      workspaceId,
      installationId: 42,
      returnTo: `/install?workspaceId=${workspaceId}`,
    });
    return json(route, connection(callbackUrl()));
  });
  let authorized = false;
  await page.route("**/v1/auth/github/callback", (route) => {
    expect(route.request().headers()["x-csrf-token"]).toBe("csrf-original");
    authorized = true;
    return json(route, issued(`/install?workspaceId=${workspaceId}`));
  });

  await open(page, "/install?installationId=42");
  await page.getByTestId("connect-installation").click();
  await page.waitForURL(
    (url) =>
      url.pathname === "/install" &&
      url.searchParams.get("workspaceId") === workspaceId,
  );
  await ready(page);
  expect(authorized).toBe(true);
  // The candidate start skips GitHub's setup page, so only the authorization
  // record was written, and the callback consumed it.
  expect(await storedFlow(page, flowKeys.installSetup)).toBeNull();
  expect(await storedFlow(page, flowKeys.installAuthorize)).toBeNull();
});
