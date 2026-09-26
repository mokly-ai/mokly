import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { fulfillScopedShell } from "./scoped_shell_fixture.js";
import {
  expectDesktopFrameRetained,
  expectHydrated,
  isEvidenceRequest,
  latch,
  markDesktopFrame,
} from "./scoped_shell_helpers.js";

const actionRoute = "/view/components/action.html";
const toolbarRoute = "/view/components/toolbar.html";

test("returning to the first route waits for its own evidence", async ({
  page,
}) => {
  const held = latch();
  let returnRequests = 0;
  await page.route("**/view/**", async (route) => {
    if (isEvidenceRequest(route, actionRoute)) {
      returnRequests += 1;
      held.markRequested();
      await held.wait;
    }
    await fulfillScopedShell(route);
  });
  await leaveAndReturn(page);
  await held.requested;

  const usage = await openUsage(page);
  await expect(usage).toHaveText("Loading usage…");
  await expect(consumerLink(page)).toHaveCount(0);
  await expect(page.locator("[data-workspace-highlight]")).toHaveAttribute(
    "title",
    "Waiting for the component preview.",
  );
  await markDesktopFrame(page);

  held.release();
  await expect(usage.getByRole("heading", { name: /Used by/ })).toBeVisible();
  await expect(consumerLink(page)).toBeVisible();
  await expectDesktopFrameRetained(page);
  expect(returnRequests).toBe(1);
  await page.unrouteAll({ behavior: "wait" });
});

test("a failed return read offers Try again instead of first-load Usage", async ({
  page,
}) => {
  const retry = latch();
  let returnRequests = 0;
  await page.route("**/view/**", async (route) => {
    if (isEvidenceRequest(route, actionRoute)) {
      returnRequests += 1;
      if (returnRequests === 1) {
        await route.abort("failed");
        return;
      }
      retry.markRequested();
      await retry.wait;
    }
    await fulfillScopedShell(route);
  });
  await leaveAndReturn(page);

  const usage = await openUsage(page);
  await expect(usage.getByRole("alert")).toHaveText(
    "Usage couldn’t be loaded.",
  );
  await expect(consumerLink(page)).toHaveCount(0);
  await markDesktopFrame(page);

  await usage.getByRole("button", { name: "Try again" }).click();
  await retry.requested;
  await expect(usage).toHaveText("Loading usage…");
  retry.release();

  await expect(usage.getByRole("heading", { name: /Used by/ })).toBeVisible();
  await expect(consumerLink(page)).toBeVisible();
  await expectDesktopFrameRetained(page);
  expect(returnRequests).toBe(2);
  await page.unrouteAll({ behavior: "wait" });
});

/** Load Action directly, adopt Toolbar's evidence, then navigate back. */
async function leaveAndReturn(page: Page) {
  await page.goto(actionRoute);
  await expectHydrated(page);
  const initialUsage = await openUsage(page);
  await expect(consumerLink(page)).toBeVisible();
  await expect(initialUsage).not.toContainText("Loading usage…");

  const toolbarEvidence = page.waitForResponse(
    (response) =>
      response.request().resourceType() === "fetch" &&
      new URL(response.url()).pathname === toolbarRoute,
  );
  await page.locator(`[data-mokly-nav] a[href="${toolbarRoute}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${toolbarRoute}$`));
  await toolbarEvidence;
  const toolbarUsage = await openUsage(page);
  await expect(
    toolbarUsage.getByRole("heading", { name: /Used by/ }),
  ).toBeVisible();
  await expect(toolbarUsage).not.toContainText("Loading usage…");

  await page.locator(`[data-mokly-nav] a[href="${actionRoute}"]`).click();
  await expect(page).toHaveURL(new RegExp(`${actionRoute}$`));
}

/** Open Usage without toggling it closed when it is already selected. */
async function openUsage(page: Page) {
  const tab = page.getByRole("tab", { name: "Usage", exact: true });
  await expect(tab).toBeVisible();
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  return page.getByRole("tabpanel", { name: "Usage", exact: true });
}

/** Action's recorded consumer, present only in ready, complete Usage. */
function consumerLink(page: Page) {
  return page
    .getByRole("tabpanel", { name: "Usage", exact: true })
    .getByRole("link", { name: "Welcome", exact: true });
}
