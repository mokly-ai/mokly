import type { Page, Route } from "@playwright/test";

import { apiFailure } from "./api-responses";
import { previewSignInEmail, previewSignInSecret } from "./api-server";
import { stateDocumentViolations } from "./document-policy";
import { expect, navigateMagicLink, ready, test } from "./harness";
import { apiOrigin, appOrigin } from "./origins";

const callbackPath = "/auth/preview/callback";
const wrongSecret = "3".repeat(64);

async function openPreview(page: Page, secret: string): Promise<void> {
  await navigateMagicLink(page, `${appOrigin}${callbackPath}#secret=${secret}`);
}

async function waitForDestination(page: Page): Promise<void> {
  await page.waitForURL((url) => url.pathname !== callbackPath);
  await ready(page);
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

function routedFailure(
  route: Route,
  reason: "operation-unavailable" | "rate-limited",
  retryAfter?: string,
): Promise<void> {
  const { status, body } = apiFailure(reason);
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": appOrigin,
      "Access-Control-Expose-Headers": "Retry-After, X-Request-Id",
      ...(retryAfter ? { "Retry-After": retryAfter } : {}),
    },
    body,
  });
}

async function expectPreviewFailure(
  page: Page,
  title: string,
  details: boolean,
): Promise<void> {
  const alert = page.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert.locator(":scope > .fo-state-glyph")).toBeVisible();
  await expect(alert.locator(":scope > .fo-sr-only")).toHaveText(title);
  await expect(alert.locator(":scope > .fo-state-title")).toHaveCount(0);
  await expect(alert.locator(":scope > .fo-state-detail")).toHaveCount(0);
  await expect(alert.getByText("Details")).toHaveCount(details ? 1 : 0);
  expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
}

test("a preview link signs in through the configured API", async ({ page }) => {
  await openPreview(page, previewSignInSecret);
  await waitForDestination(page);

  expect(await signedInEmail(page)).toBe(previewSignInEmail);
  expect(page.url()).not.toContain("secret=");
});

test("a missing preview secret is local invalid-link recovery", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/v1/auth/preview", (route) => {
    if (route.request().method() === "POST") requests += 1;
    return route.continue();
  });
  await page.goto(callbackPath);

  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn’t valid" }),
  ).toBeVisible();
  await expectPreviewFailure(page, "This link isn’t valid", false);
  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  expect(requests).toBe(0);
});

test("an invalid preview secret has no retry action", async ({ page }) => {
  await openPreview(page, wrongSecret);

  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn’t valid" }),
  ).toBeVisible();
  await expectPreviewFailure(page, "This link isn’t valid", true);
  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  expect(page.url()).not.toContain("secret=");
});

test("a generic preview failure retries the in-memory secret", async ({
  page,
}) => {
  const bodies: string[] = [];
  await page.route("**/v1/auth/preview", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postData() ?? "");
    if (bodies.length === 1) {
      return routedFailure(route, "operation-unavailable");
    }
    return route.continue();
  });
  await openPreview(page, previewSignInSecret);

  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn’t sign you in" }),
  ).toBeVisible();
  await expectPreviewFailure(page, "We couldn’t sign you in", true);
  await page.getByRole("button", { name: "Try again" }).click();
  await waitForDestination(page);

  expect(bodies).toEqual([
    JSON.stringify({ secret: previewSignInSecret }),
    JSON.stringify({ secret: previewSignInSecret }),
  ]);
  expect(page.url()).not.toContain("secret=");
});

test("a rate-limited retry waits for Retry-After", async ({ page }) => {
  const attempts: number[] = [];
  await page.route("**/v1/auth/preview", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts.push(Date.now());
    if (attempts.length === 1) {
      return routedFailure(route, "rate-limited", "1");
    }
    return route.continue();
  });
  await openPreview(page, previewSignInSecret);

  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn’t sign you in" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  // The heading already says Signing you in, so the wait names itself for
  // screen readers only, and the one state card under the heading stays
  // visible in its placeholder form. The placeholder is hidden from assistive
  // technology, so it is found by the waiting region and its part.
  const pending = page.getByRole("status");
  await expect(pending).toContainText("Signing you in");
  await expect(pending).toHaveClass(/\bfo-sr-only\b/);
  await expect(page.locator('[aria-busy="true"] .fo-wait-state')).toBeVisible();
  expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
  await waitForDestination(page);

  expect(attempts).toHaveLength(2);
  expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(900);
});
