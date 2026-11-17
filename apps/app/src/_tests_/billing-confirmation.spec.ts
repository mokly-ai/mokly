import type { Page } from "@playwright/test";

import { startCheckoutThrough, subscribe } from "./billing";
import { sql } from "./database-fixture";
import { failureShape } from "./fragment";
import {
  apiFailure,
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  workspaceSettingsPathFor,
  projectPathFor,
  projectQueryPathFor,
  signIn,
  test,
} from "./harness";

/** The read a Checkout return polls until its webhook has changed the plan. */
const billingRead = "**/v1/workspaces/*/billing";

/** Sign one owner in with a project, and answer with both identifiers. */
async function owner(
  page: Page,
  label: string,
): Promise<{ workspaceId: string; projectId: string }> {
  await signIn(page, freshEmail(label));
  const projectId = await createProject(page, label + " Org");
  return { workspaceId: await currentWorkspaceId(page), projectId };
}

/** The pane's fact list after confirmation resolves. */
function facts(page: Page) {
  return page.locator(".fo-facts").first();
}

test("returning from Checkout refreshes the working project before settings closes", async ({
  page,
}) => {
  const { workspaceId, projectId } = await owner(page, "confirm");
  sql(
    `UPDATE projects SET visibility = 'private', version = version + 1 WHERE id = '${projectId}'`,
  );
  await page.goto(
    await projectQueryPathFor(
      page,
      projectId,
      "settings=billing&checkout=success",
    ),
  );
  await expect(page.getByText("Confirming your subscription…")).toBeVisible();
  // The plan is written by the webhook rather than by the return, so the pane
  // waits for the worker and settles on what it wrote.
  await subscribe(page, workspaceId, { status: "active", editors: 1 });
  await expect(facts(page)).toContainText("Team");
  await expect(page).toHaveURL(/settings=billing$/);
  await expect(page.getByText("Confirming your subscription…")).toHaveCount(0);
  await page.getByTestId("close-settings").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Publishing to private projects is on Team"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Set up publishing" }),
  ).toBeVisible();
});

test("a durable Checkout return stays delayed until Team is confirmed", async ({
  page,
}) => {
  const { workspaceId, projectId } = await owner(page, "delayed");
  await page.clock.install();
  let activeReads = 0;
  let mostActiveReads = 0;
  let reads = 0;
  await page.route(billingRead, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    reads += 1;
    activeReads += 1;
    mostActiveReads = Math.max(mostActiveReads, activeReads);
    try {
      const answer = await route.fetch();
      await route.fulfill({ response: answer });
    } finally {
      activeReads -= 1;
    }
  });

  const billingPath = await workspaceSettingsPathFor(
    page,
    workspaceId,
    "billing",
  );
  const viewer = await projectPathFor(page, projectId);
  await page.goto(`${billingPath}?checkout=success`);
  await expect(page.getByText("Confirming your subscription…")).toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toBe(viewer);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("settings"))
    .toBe("billing");
  await page.clock.fastForward(30_001);
  await expect(
    page.getByText("Still confirming your subscription"),
  ).toBeVisible();
  await expect(page.getByTestId("upgrade-to-team")).toHaveCount(0);
  expect(mostActiveReads).toBe(1);

  const beforeFreeCheck = reads;
  await page.getByTestId("check-subscription").click();
  await expect(page.getByTestId("check-subscription")).toHaveText(
    "Check again",
  );
  expect(reads).toBe(beforeFreeCheck + 1);
  await expect(
    page.getByText("Still confirming your subscription"),
  ).toBeVisible();
  await expect(page.getByTestId("upgrade-to-team")).toHaveCount(0);

  await subscribe(page, workspaceId, { status: "active", editors: 1 });
  const beforeTeamCheck = reads;
  await page.getByTestId("check-subscription").click();
  await expect(facts(page)).toContainText("Team");
  // The check reads Team once. Its invalidation refreshes the workspace and
  // project with the pane kept in place, so the success landing still owns
  // the pane's reads and nothing reads billing again.
  await expect.poll(() => reads).toBe(beforeTeamCheck + 1);
  await expect(
    page.getByText("Still confirming your subscription"),
  ).toHaveCount(0);
  await expect(page.getByTestId("upgrade-to-team")).toHaveCount(0);
  const settledReads = reads;
  await page.clock.fastForward(30_001);
  expect(reads).toBe(settledReads);
  expect(mostActiveReads).toBe(1);
});

test("a failed confirmation read shows the pane error and its retry", async ({
  page,
}) => {
  const { projectId } = await owner(page, "confirmation-read-fails");
  const failure = apiFailure("unavailable");
  await page.route(billingRead, (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: failure.status,
      contentType: "application/json",
      body: failure.body,
    });
  });

  await page.goto(
    await projectQueryPathFor(
      page,
      projectId,
      "settings=billing&checkout=success",
    ),
  );
  await expect(page.getByText("Billing couldn’t load")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByText("Still confirming your subscription"),
  ).toHaveCount(0);
});

test("a failed Check again read stays beside its retryable control", async ({
  page,
}) => {
  const { projectId } = await owner(page, "confirmation-check-fails");
  await page.clock.install();
  let failCheck = false;
  const failure = apiFailure("unavailable");
  await page.route(billingRead, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    if (failCheck) {
      return route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: failure.body,
      });
    }
    const answer = await route.fetch();
    return route.fulfill({ response: answer });
  });

  await page.goto(
    await projectQueryPathFor(
      page,
      projectId,
      "settings=billing&checkout=success",
    ),
  );
  await expect(page.getByText("Confirming your subscription…")).toBeVisible();
  await page.clock.fastForward(30_001);
  await expect(
    page.getByText("Still confirming your subscription"),
  ).toBeVisible();

  failCheck = true;
  const check = page.getByTestId("check-subscription");
  await check.click();
  const fragment = page.locator(".fo-write-failure").filter({ has: check });
  await expect(fragment.getByRole("alert")).toHaveText(
    "Mokly is busy. Try again in a moment.",
  );
  await expect(check).toHaveText("Try again");
  await expect(fragment.getByText("Details")).toBeVisible();
  expect(await failureShape(page, "check-subscription")).toEqual({
    causeAbove: true,
    references: 1,
    detailsBelow: true,
  });
});

test("leaving Checkout returns the pane as it was, and costs no entry", async ({
  page,
}) => {
  const { projectId } = await owner(page, "cancelled");
  const viewer = await projectPathFor(page, projectId);
  await open(page, viewer);
  await page.goto(`${viewer}?settings=billing&checkout=cancelled`);
  await expect(page.getByText("Free for open-source catalogues")).toBeVisible();
  await expect(page).toHaveURL(/settings=billing$/);
  // The parameter was removed rather than written over, so one press of Back
  // is the page the reader opened the dialog from.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(viewer + "$"));
});

test("starting Checkout twice before provider expiry returns the same open session", async ({
  page,
}) => {
  // The API returns the one durable session until its provider expiry, so a
  // second press cannot create another session the reader could pay for too.
  const { workspaceId } = await owner(page, "sessions");
  const first = await startCheckoutThrough(page, workspaceId);
  const second = await startCheckoutThrough(page, workspaceId);
  expect(second).toBe(first);
});
