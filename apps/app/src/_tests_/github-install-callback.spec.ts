import { apiFailure } from "./api-responses";
import {
  callbackUrl,
  flowKeys,
  githubState,
  issued,
  json,
  routeSignedInSession,
  seedFlow,
  storedFlow,
} from "./auth-callbacks";
import { expect, open, ready, test } from "./harness";

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
