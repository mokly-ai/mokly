import type { Page } from "@playwright/test";

import { projectQueryPathFor } from "./addresses";
import { periodEndsOn, subscribe } from "./billing";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  openDialog,
  signIn,
  test,
} from "./harness";
import { createProject } from "./project-setup";

/** The Billing pane against the real API, its real provider and its worker. */

/** The read this pane draws every fact from. */
const billingRead = "**/v1/workspaces/*/billing";

/** The pane's fact list, whichever situation drew it. */
function facts(page: Page) {
  return page.locator(".fo-facts").first();
}

/** Sign one owner in with a project, and answer with both identifiers. */
async function owner(
  page: Page,
  label: string,
): Promise<{ workspaceId: string; projectId: string }> {
  await signIn(page, freshEmail(label));
  const projectId = await createProject(page, label + " Org");
  return { workspaceId: await currentWorkspaceId(page), projectId };
}

/** Open the pane over the project's viewer, where the dialog is drawn. */
async function openBilling(page: Page, projectId: string): Promise<void> {
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=billing"),
  );
}

test("the free plan names what Team costs and offers the trial", async ({
  page,
}) => {
  const { projectId } = await owner(page, "free");
  await openBilling(page, projectId);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { level: 1 })).toHaveText("Billing");
  await expect(page.getByText("Free for open-source catalogues")).toBeVisible();
  await expect(page.getByText("Every project is public.")).toBeVisible();
  // Both amounts are the verified prices the API answered with, not numbers
  // this screen holds.
  await expect(facts(page)).toContainText("Editor");
  await expect(facts(page)).toContainText("$20 a month");
  await expect(facts(page)).toContainText("Collaborator");
  await expect(facts(page)).toContainText("$5 a month");
  await expect(page.getByText("Team starts with a 7-day trial.")).toBeVisible();
  await expect(page.getByTestId("upgrade-to-team")).toBeVisible();
  await expect(page.getByText("Pricing")).toHaveCount(0);
});

test("Upgrade to Team leaves for the session Stripe hosts", async ({
  page,
}) => {
  const { projectId } = await owner(page, "checkout");
  // Stripe's own page is not served here, so the hosted address answers with a
  // document of its own; the assertion is that the browser was sent to it.
  await page.route("https://checkout.stripe.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<p>pay</p>",
    }),
  );
  await openBilling(page, projectId);
  const created = page.waitForResponse(
    (answer) =>
      answer.url().endsWith("/billing/checkout") &&
      answer.request().method() === "POST",
  );
  await page.getByTestId("upgrade-to-team").click();
  expect((await created).status()).toBe(201);
  await page.waitForURL(/checkout\.stripe\.test/);
});

test("a subscribed workspace reads its seats, total and renewal", async ({
  page,
}) => {
  const { workspaceId, projectId } = await owner(page, "team");
  await subscribe(page, workspaceId, { status: "active", editors: 1 });
  await page.route("https://billing.stripe.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<p>portal</p>",
    }),
  );
  await openBilling(page, projectId);
  await expect(facts(page)).toContainText("Plan");
  await expect(facts(page)).toContainText("Team");
  await expect(facts(page)).toContainText("1 in use · $20 each a month");
  await expect(facts(page)).toContainText("Monthly total");
  await expect(facts(page)).toContainText("$20");
  await expect(facts(page)).toContainText("Renews");
  await expect(facts(page)).toContainText(periodEndsOn);
  await expect(page.getByText("Free for open-source catalogues")).toHaveCount(
    0,
  );
  await page.getByTestId("manage-billing").click();
  await page.waitForURL(/billing\.stripe\.test/);
});

test("Upgrade to Team keeps its label when a subscription is already live", async ({
  page,
}) => {
  const { workspaceId, projectId } = await owner(page, "live");
  await subscribe(page, workspaceId, { status: "active", editors: 1 });
  // This is the confirmation gap the API protects: Checkout already sees the
  // live subscription while this read still says Free.
  await page.route(billingRead, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const answer = await route.fetch();
    const body = (await answer.json()) as { plan: string };
    body.plan = "free";
    return route.fulfill({ response: answer, json: body });
  });
  await openBilling(page, projectId);
  const refused = page.waitForResponse(
    (answer) =>
      answer.url().endsWith("/billing/checkout") &&
      answer.request().method() === "POST",
  );
  await page.getByTestId("upgrade-to-team").click();
  expect((await refused).status()).toBe(400);
  await expect(
    page.getByText("Your subscription is still being confirmed."),
  ).toBeVisible();
  await expect(page.getByTestId("upgrade-to-team")).toHaveText(
    "Upgrade to Team",
  );
});
