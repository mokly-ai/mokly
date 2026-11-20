import type { Locator, Page } from "@playwright/test";

import { projectAddress } from "./addresses";
import { apiFailure } from "./api-responses";
import { expect, freshEmail, open, openDialog, signIn, test } from "./harness";
import { createProject } from "./project-setup";

/**
 * A refused write keeps the reader's keyboard position, as Write failure and
 * Write in progress in `folio-chrome.md` define them: the refusal is drawn
 * around the control that was pressed, that control is the way back, and a
 * busy control keeps its focus. Each test presses from the keyboard, sees the
 * refusal, retries from the keyboard and reads the control while the retry
 * works, so a control that the refusal or the retry replaces loses focus and
 * fails.
 */

/** What the API says when Mokly is busy, which the same request can get past. */
const busy = "Mokly is busy. Try again in a moment.";

/**
 * Refuse every press of one write as Mokly being busy. The first refusal
 * answers at once; each later one waits until the test lets it answer, so a
 * retry is read while it works. It also counts the requests sent.
 */
async function refuseEveryPress(page: Page, url: string, method: string) {
  const { status, body } = apiFailure("unavailable");
  const retried = Promise.withResolvers<void>();
  const answer = Promise.withResolvers<void>();
  let sent = 0;
  await page.route(url, async (route) => {
    if (route.request().method() !== method) return route.fallback();
    sent += 1;
    if (sent > 1) {
      retried.resolve();
      await answer.promise;
    }
    return route.fulfill({ status, contentType: "application/json", body });
  });
  return {
    retried: retried.promise,
    answer: () => answer.resolve(),
    sent: () => sent,
  };
}

/**
 * Press the control from the keyboard and see it refused with focus kept,
 * press it again and see it keep focus while the retry works, then see the
 * retry refused with focus still kept.
 */
async function refuseAndRetry(
  page: Page,
  control: Locator,
  refusals: Awaited<ReturnType<typeof refuseEveryPress>>,
  working: string,
): Promise<void> {
  const fragment = page.locator(".fo-write-failure").filter({ has: control });
  await control.focus();
  await page.keyboard.press("Enter");
  await expect(fragment.getByRole("alert"), "refused").toHaveText(busy);
  await expect(control, "the way back").toHaveText("Try again");
  await expect(control, "focus stays on the refused control").toBeFocused();

  await page.keyboard.press("Enter");
  await refusals.retried;
  await expect(control, "the working word").toHaveText(working);
  await expect(control, "busy").toHaveAttribute("aria-busy", "true");
  await expect(control, "focus stays while the retry works").toBeFocused();

  refusals.answer();
  await expect(fragment.getByRole("alert"), "refused again").toHaveText(busy);
  await expect(control, "the way back again").toHaveText("Try again");
  await expect(control, "focus stays after the retry").toBeFocused();
  expect(refusals.sent(), "one request for each press").toBe(2);
}

test("a refused sign-in link keeps Continue with email focused through its retry", async ({
  page,
}) => {
  await open(page, "/sign-in");
  await page.getByLabel("Email").fill(freshEmail("retry-focus"));
  const refusals = await refuseEveryPress(
    page,
    "**/v1/auth/magic-links",
    "POST",
  );
  await refuseAndRetry(
    page,
    page.getByTestId("email-entry"),
    refusals,
    "Sending…",
  );
});

test("a refused name keeps Save changes focused through its retry", async ({
  page,
}) => {
  await signIn(page, freshEmail("pane-retry-focus"));
  const projectId = await createProject(page, "Retry Focus Org");
  const address = await projectAddress(page, projectId);
  await openDialog(page, `${address.path}?settings=account`);
  await page.getByLabel("Name", { exact: true }).fill("Focus Reader");
  const refusals = await refuseEveryPress(page, "**/v1/account", "PATCH");
  await refuseAndRetry(
    page,
    page.getByTestId("save-account"),
    refusals,
    "Saving…",
  );
});
