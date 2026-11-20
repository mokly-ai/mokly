import type { ApiReason } from "../api/reasons";

import { apiFailure } from "./api-responses";
import {
  callbackUrl,
  connection,
  flowKeys,
  githubState,
  issued,
  json,
  otherState,
  seedFlow,
  session,
  storedFlow,
} from "./auth-callbacks";
import { expect, open, ready, test } from "./harness";

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
