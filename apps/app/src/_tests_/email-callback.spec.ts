import type { Page } from "@playwright/test";

import { stateDocumentViolations } from "./document-policy";
import { expect, freshEmail, navigateMagicLink, signIn, test } from "./harness";
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
  await signIn(page, email);
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
