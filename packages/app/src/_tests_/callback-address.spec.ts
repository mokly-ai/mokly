import type { Page } from "@playwright/test";

import { recordAddresses, recordedAddresses } from "./address-log";
import {
  callbackUrl,
  flowKeys,
  installUrl,
  otherState,
  seedFlow,
} from "./auth-callbacks";
import { expect, freshEmail, open, walkSignIn, test } from "./harness";

/**
 * A landing's credential leaves the address once and never returns to it. The
 * visible URL cannot show that: the router used to write the credential back
 * for one render, and whether a check saw that render depended on how fast the
 * machine was. Every address the landing's document took is read instead.
 */
async function landingAddresses(
  page: Page,
): Promise<{ first: string; later: string[] }> {
  const [first = "", ...later] = await recordedAddresses(page);
  expect(later.length, "the landing wrote its address").toBeGreaterThan(0);
  return { first, later };
}

test("an exchanged email token never returns to the address", async ({
  page,
}) => {
  await recordAddresses(page);
  await walkSignIn(page, freshEmail("address"));

  const { first, later } = await landingAddresses(page);
  expect(first).toContain("#token=");
  expect(later.filter((address) => address.includes("token="))).toEqual([]);
});

test("a refused email token never returns to the address", async ({ page }) => {
  await recordAddresses(page);
  await page.route("**/v1/auth/callback", (route) => route.abort());
  const first = "a".repeat(64);
  const second = "b".repeat(64);
  await page.goto(
    `/auth/email/callback?source=test#token=${first}&token=${second}`,
  );
  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();

  const addresses = await landingAddresses(page);
  expect(addresses.first).toContain("#token=");
  for (const address of addresses.later) {
    expect(new URL(address).hash).toBe("");
    expect(new URL(address).search).toBe("?source=test");
  }
});

test("GitHub's code and state never return to the address", async ({
  page,
}) => {
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.signIn);
  await recordAddresses(page);
  await page.goto(callbackUrl(otherState));
  await expect(
    page.getByRole("button", { name: "Back to sign in" }),
  ).toBeVisible();

  const { first, later } = await landingAddresses(page);
  expect(new URL(first).searchParams.get("code")).toBe("provider-code");
  for (const address of later) expect(new URL(address).search).toBe("");
});

test("GitHub's installation values never return to the address", async ({
  page,
}) => {
  await open(page, "/sign-in");
  await seedFlow(page, flowKeys.installSetup);
  await recordAddresses(page);
  await page.goto(installUrl(otherState));
  await expect(
    page.getByRole("button", { name: "Back to install" }),
  ).toBeVisible();

  const { first, later } = await landingAddresses(page);
  expect(new URL(first).searchParams.get("installation_id")).toBe("42");
  for (const address of later) expect(new URL(address).search).toBe("");
});
