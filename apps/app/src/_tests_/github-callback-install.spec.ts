import type { ApiReason } from "../api/reasons";

import {
  callbackUrl,
  flowKeys,
  routeSignedInSession,
  seedFlow,
  storedFlow,
} from "./auth-callbacks";
import { apiFailure, expect, open, ready, test } from "./harness";

const installationRefusals: readonly {
  reason: ApiReason;
  title: string;
  line?: string;
}[] = [
  {
    reason: "github-installation-conflict",
    title: "This GitHub account is connected to another workspace",
    line: "Remove it from that workspace first.",
  },
  {
    reason: "permission-denied",
    title: "You don’t administer this GitHub account",
  },
];

test("an installation authorization names why the account was not connected", async ({
  page,
}) => {
  let reason: ApiReason = "github-installation-conflict";
  await routeSignedInSession(page);
  await page.route("**/v1/auth/github/callback", (route) => {
    const failure = apiFailure(reason);
    return route.fulfill({
      status: failure.status,
      contentType: "application/json",
      body: failure.body,
    });
  });
  await open(page, "/sign-in");

  for (const refusal of installationRefusals) {
    reason = refusal.reason;
    await seedFlow(page, flowKeys.installAuthorize);
    await page.goto(callbackUrl().replace(/^https?:\/\/[^/]+/, ""));
    await ready(page);
    await expect(
      page.getByRole("heading", { level: 1, name: refusal.title }),
    ).toBeVisible();
    // The heading is the outcome, so the state never repeats it as a title.
    await expect(
      page.getByRole("heading", { level: 2, name: refusal.title }),
    ).toHaveCount(0);
    const alert = page.getByRole("alert");
    if (refusal.line) await expect(alert).toHaveText(new RegExp(refusal.line));
    else await expect(alert.locator(".fo-sr-only")).toHaveText(refusal.title);
    await expect(alert.locator("details")).toHaveCount(1);
    const back = page.getByRole("button", { name: "Back to install" });
    await expect(back).toBeVisible();
    expect(await storedFlow(page, flowKeys.installAuthorize)).toBeNull();
  }
  await page.getByRole("button", { name: "Back to install" }).click();
  await page.waitForURL((url) => url.pathname === "/install");
});
