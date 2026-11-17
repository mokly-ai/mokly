import type { Locator, Page } from "@playwright/test";

import { projectQueryPathFor } from "../addresses";
import { connection, githubState, json } from "../auth-callbacks";
import { subscribe } from "../billing";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  openDialog,
  signIn,
  test,
} from "../harness";
import { githubOrigin } from "../origins";
import { createProject } from "../project-setup";

/**
 * A pane write that leaves for GitHub or Stripe, as Write in progress in
 * `folio-chrome.md` defines it: the pressed control carries the wait until the
 * page has gone, so it stays busy while the page leaves.
 *
 * The browser defers every read of a page whose navigation is still pending,
 * so a page that is leaving cannot be read. Each trip here is answered with
 * 204 No Content, which ends that navigation and keeps the page exactly as it
 * was while it left.
 */

/** Answer every trip to `url` with 204 No Content, and list each one. */
async function stopTrips(page: Page, url: string): Promise<string[]> {
  const trips: string[] = [];
  await page.route(url, (route) => {
    trips.push(route.request().url());
    return route.fulfill({ status: 204 });
  });
  return trips;
}

/** Press the control, and read it once its page has started to leave. */
async function leavesBusy(
  page: Page,
  control: Locator,
  trips: readonly string[],
  busy: { working: string; operation: string },
): Promise<void> {
  await control.click();
  await expect.poll(() => trips.length, "the page leaves").toBe(1);
  await expect(control, "the working word").toHaveText(busy.working);
  await expect(control, "busy until the page leaves").toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(control, "still enabled").toBeEnabled();
  await expect(
    page.getByRole("status").filter({ hasText: busy.operation + "…" }),
    "a screen reader hears the operation",
  ).toHaveCount(1);
}

test("a pane write that leaves for GitHub or Stripe stays busy until the page leaves", async ({
  page,
}) => {
  await signIn(page, freshEmail("leaving-writes"));
  await page.waitForURL((url) => url.pathname === "/new");

  // Connect GitHub leaves for GitHub's authorization. The start is answered
  // here, so the walk sends no GitHub flow start to the API.
  await page.route("**/v1/github/connection", (route) =>
    json(
      route,
      connection(`${githubOrigin}/login/oauth/authorize?state=${githubState}`),
    ),
  );
  let trips = await stopTrips(page, `${githubOrigin}/**`);
  await openDialog(page, "/new?settings=account");
  await leavesBusy(page, page.getByTestId("settings-connect-github"), trips, {
    working: "Connecting…",
    operation: "Connecting to GitHub",
  });
  await page.unrouteAll({ behavior: "wait" });

  // Add GitHub account leaves for GitHub's installation page.
  const projectId = await createProject(page, "Leaving Org");
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/v1/github/installations", (route) =>
    route.request().method() === "POST"
      ? json(
          route,
          connection(
            `${githubOrigin}/apps/mokly/installations/new?state=${githubState}`,
          ),
        )
      : route.continue(),
  );
  trips = await stopTrips(page, `${githubOrigin}/**`);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=github"),
  );
  await leavesBusy(page, page.getByTestId("add-github-account"), trips, {
    working: "Adding…",
    operation: "Adding a GitHub account",
  });
  await page.unrouteAll({ behavior: "wait" });

  // Upgrade to Team leaves for Stripe's Checkout.
  trips = await stopTrips(page, "https://checkout.stripe.test/**");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=billing"),
  );
  await leavesBusy(page, page.getByTestId("upgrade-to-team"), trips, {
    working: "Opening…",
    operation: "Opening checkout",
  });
  await page.unrouteAll({ behavior: "wait" });

  // Manage billing leaves for Stripe's Customer Portal.
  await subscribe(page, await currentWorkspaceId(page), {
    status: "active",
    editors: 1,
  });
  trips = await stopTrips(page, "https://billing.stripe.test/**");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=billing"),
  );
  await leavesBusy(page, page.getByTestId("manage-billing"), trips, {
    working: "Opening…",
    operation: "Opening the billing portal",
  });
  await page.unrouteAll({ behavior: "wait" });
});
