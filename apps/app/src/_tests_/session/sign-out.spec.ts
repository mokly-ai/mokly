import type { Page, Route } from "@playwright/test";

import type { Session } from "../../api/types";
import { settingsPath, signInPath } from "../../navigation/paths";
import { apiFailure } from "../api-responses";
import { expect, freshEmail, openDialog, signIn, test } from "../harness";
import { apiOrigin } from "../origins";

const sessionUrl = `${apiOrigin}/v1/session`;
const accountPath = settingsPath({ pane: "account" });

/** Finish every routed DELETE before the test can close its browser context. */
async function interceptSignOut(
  page: Page,
  answer: (route: Route) => Promise<void>,
): Promise<() => Promise<void>> {
  const pending: Promise<void>[] = [];
  const intercept = (route: Route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    const response = answer(route);
    pending.push(response);
    return response;
  };
  await page.route(sessionUrl, intercept);
  return async () => {
    await page.unroute(sessionUrl, intercept);
    await Promise.all(pending);
  };
}

test("failed sign out keeps authentication until retry or confirmation", async ({
  page,
}) => {
  const email = freshEmail("failed-sign-out");
  await signIn(page, email);
  await openDialog(page, accountPath);
  const account = page.getByRole("dialog", { name: "Account", exact: true });
  const control = page.getByTestId("sign-out");
  const entry = page.getByRole("heading", { name: "Sign in to Mokly" });
  await expect(account.getByLabel("Name", { exact: true })).toBeVisible();
  const accountAddress = page.url();

  const failures = [
    {
      kind: "api",
      reason: "unavailable",
      cause: "Mokly is busy. Try again in a moment.",
    },
    {
      kind: "api",
      reason: "csrf-rejected",
      cause: "Reload the page and try again.",
    },
    { kind: "transport", cause: "Mokly is busy. Try again in a moment." },
  ] as const;

  for (const failure of failures) {
    const stop = await interceptSignOut(page, async (route) => {
      if (failure.kind === "transport") return route.abort("failed");
      const answer = apiFailure(failure.reason);
      return route.fulfill({
        status: answer.status,
        contentType: "application/json",
        body: answer.body,
      });
    });
    try {
      await control.click();

      // Wait for the completed write before checking authentication. The bug
      // reaches sign-in instead of drawing the failure beside the control.
      await expect(page.getByRole("alert").or(entry)).toBeVisible();
      await expect(
        account,
        `${failure.kind}: a failed sign out must keep the account pane open`,
      ).toBeVisible();
      await expect(page).toHaveURL(accountAddress);
      await expect(account.getByRole("alert")).toHaveText(failure.cause);
      await expect(control).toHaveText("Try again");
      await expect(control).toBeEnabled();
      await expect(account.getByText("Details", { exact: true })).toBeVisible();

      // This API read uses the real HttpOnly cookie. It does not reload the
      // app's session, so the final retry still depends on its kept CSRF token.
      const retained = await page.request.get(sessionUrl);
      expect(retained.status()).toBe(200);
      const body: unknown = await retained.json();
      const user: Pick<Session["user"], "email"> = { email };
      expect(body).toMatchObject({ user });
    } finally {
      await stop();
    }
  }

  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  const stopHolding = await interceptSignOut(page, async (route) => {
    requests += 1;
    await held;
    return route.continue();
  });
  try {
    const revoked = page.waitForResponse(
      (answer) =>
        answer.url() === sessionUrl && answer.request().method() === "DELETE",
    );
    // Two presses in one turn cannot be arranged by separate browser clicks.
    // This also checks the write guard before React can make the button busy.
    await control.evaluate((button) => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(control).toHaveText("Signing out…");
    // The working control refuses a second press through its busy state and
    // keeps focus, as Write in progress in `folio-chrome.md` defines.
    await expect(control).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => requests).toBe(1);
    release();
    expect((await revoked).status()).toBe(204);
    await expect(page).toHaveURL((url) => url.pathname === signInPath);
    await expect(entry).toBeVisible();
    expect(requests).toBe(1);
  } finally {
    release();
    await stopHolding();
  }
  expect((await page.request.get(sessionUrl)).status()).toBe(401);
  await page.reload();
  await expect(entry).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === signInPath);

  for (const reason of ["unauthenticated", "session-expired"] as const) {
    await signIn(page, freshEmail(`sign-out-${reason}`));
    await openDialog(page, accountPath);
    const stop = await interceptSignOut(page, async (route) => {
      // Revoke the real session and clear its cookie, then deliver the
      // authentication refusal whose outcome the session provider must accept.
      const revoked = await route.fetch();
      expect(revoked.status()).toBe(204);
      const failure = apiFailure(reason);
      return route.fulfill({
        response: revoked,
        status: failure.status,
        contentType: "application/json",
        body: failure.body,
      });
    });
    try {
      await control.click();
      await expect(page).toHaveURL((url) => url.pathname === signInPath);
      await expect(entry).toBeVisible();
    } finally {
      await stop();
    }
    expect((await page.request.get(sessionUrl)).status()).toBe(401);
    await page.reload();
    await expect(entry).toBeVisible();
  }
});
