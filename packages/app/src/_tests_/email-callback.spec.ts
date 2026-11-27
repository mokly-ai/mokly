import type { Page } from "@playwright/test";

import { stateDocumentViolations } from "./document-policy";
import {
  expect,
  freshEmail,
  navigateMagicLink,
  walkSignIn,
  test,
} from "./harness";
import { expectScreenPolicy } from "./screen-policy";

/**
 * An email landing that cannot sign the reader in: one alert that asks for
 * another link, and Back to sign in as the only way on.
 */
async function expectEmailRecovery(page: Page, label: string): Promise<void> {
  const alert = page.getByRole("alert");
  await expect(alert).toHaveCount(1);
  await expect(alert).toContainText("Request another sign-in link");
  await expect(page.locator("main").getByRole("button")).toHaveText([
    "Back to sign in",
  ]);
  await expectScreenPolicy(page, label);
  expect(await page.evaluate(stateDocumentViolations)).toEqual([]);
}

test("a used link says so and offers another one", async ({ page }) => {
  const email = freshEmail("used");
  await walkSignIn(page, email);
  await page.waitForURL((url) => url.pathname === "/new");
  const { magicLinkFor } = await import("./api-server");
  await navigateMagicLink(page, magicLinkFor(email) as string);
  await expect(
    page.getByRole("heading", { level: 1, name: /already been used/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();
  await expectEmailRecovery(page, "the used link");
});

test("a duplicate email token is refused and removed from the URL", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/v1/auth/callback", (route) => {
    requests += 1;
    return route.abort();
  });
  const first = "a".repeat(64);
  const second = "b".repeat(64);
  await page.goto(
    `/auth/email/callback?source=test#token=${first}&token=${second}`,
  );

  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn’t valid" }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("?source=test");
  expect(new URL(page.url()).hash).toBe("");
  await expectEmailRecovery(page, "the link without one token");
  expect(requests).toBe(0);
});

/**
 * Hold the landing's exchange until the test lets it through, so the test can
 * act while the landing waits. The real API then answers it.
 */
async function holdExchange(page: Page) {
  const sent = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route("**/v1/auth/callback", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    sent.resolve();
    await release.promise;
    return route.continue();
  });
  return { sent: sent.promise, release: () => release.resolve() };
}

test("a link refused after the wait keeps the skip link focused", async ({
  page,
}) => {
  const exchange = await holdExchange(page);
  // Well formed, and no link was ever issued with it, so the API refuses it
  // as `magic-link-invalid`.
  await page.goto(`/auth/email/callback#token=${"0".repeat(64)}`);
  await exchange.sent;
  await expect(
    page.getByRole("heading", { level: 1, name: "Signing you in" }),
  ).toBeVisible();
  const skip = page.getByRole("link", { name: "Skip to content" });
  await skip.focus();
  await expect(skip, "focused during the wait").toBeFocused();

  exchange.release();
  await expect(
    page.getByRole("heading", { level: 1, name: "This link isn’t valid" }),
  ).toBeVisible();
  await expect(skip, "focus stays on the skip link").toBeFocused();
});
