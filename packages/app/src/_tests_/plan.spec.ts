import type { Page } from "@playwright/test";

import { projectPathFor, projectQueryPathFor } from "./addresses";
import { apiFailure } from "./api-responses";
import { subscribe } from "./billing";
import { downgradeToFree } from "./database-fixture";
import { installApp } from "./github-installation";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  openDialog,
  readyScreen,
  signIn,
  test,
} from "./harness";
import {
  addMember,
  currentUserId,
  grantProject,
  switchSession,
} from "./members";
import { chooseRepository, createProject } from "./project-setup";
import { makePrivate } from "./visibility";

/** How the plan reads everywhere in the product outside the Billing pane. */

const publicOnFree = "Projects are public on the free plan.";
const publishingOnTeam = "Publishing to private projects is on Team";
const askAnOwner = "Ask an owner to upgrade to Team.";

/** Sign one owner in with a project, and answer with both identifiers. */
async function owner(
  page: Page,
  label: string,
): Promise<{ workspaceId: string; projectId: string }> {
  await signIn(page, freshEmail(label));
  const projectId = await createProject(page, label + " Org");
  return { workspaceId: await currentWorkspaceId(page), projectId };
}

test("free onboarding states the public outcome before project creation", async ({
  page,
}) => {
  await signIn(page, freshEmail("public"));
  await page.waitForURL((url) => url.pathname === "/new");
  await page.getByLabel("Workspace name").fill("Public Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === "/install");
  await installApp(page);
  await expect(page.getByText(publicOnFree)).toBeVisible();
  await chooseRepository(page);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/setup$/.test(url.pathname));
  await readyScreen(page, "account-project-created");
  // The finished project reports the visibility it was actually created with.
  await expect(page.locator(".fo-facts")).toContainText("Public");
  // The created-project screen carries the visibility fact instead.
  await expect(page.getByText(publicOnFree)).toHaveCount(0);
});

test("the plan is a fact of the Workspace pane, and only Team names the seat each invitation adds", async ({
  page,
}) => {
  const { workspaceId, projectId } = await owner(page, "orgplan");
  await test.step("a free workspace does not name a seat it is not paying for", async () => {
    await openDialog(
      page,
      await projectQueryPathFor(page, projectId, "settings=members"),
    );
    await expect(page.getByText("Adds a Collaborator seat")).toHaveCount(0);
  });

  await test.step("the Workspace pane carries the plan as a fact every member reads", async () => {
    await openDialog(
      page,
      await projectQueryPathFor(page, projectId, "settings=workspace"),
    );
    await expect(page.locator(".fo-facts").first()).toContainText("Plan");
    await expect(page.locator(".fo-facts").first()).toContainText("Free");
    await subscribe(page, workspaceId, { status: "active", editors: 1 });
    await page.reload();
    await expect(page.locator(".fo-facts").first()).toContainText("Team");
  });

  await test.step("Team names the seat each invitation adds", async () => {
    await openDialog(
      page,
      await projectQueryPathFor(page, projectId, "settings=members"),
    );
    await expect(
      page.getByText("Adds a Collaborator seat, $5 a month."),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Member" }).click();
    await expect(
      page.getByText("Adds an Editor seat, $20 a month."),
    ).toBeVisible();
  });
});

test("making a project private on the free plan is refused in its modal", async ({
  page,
}) => {
  const { workspaceId, projectId } = await owner(page, "visibility");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  await page.getByTestId("change-visibility").click();
  const ownerModal = page.getByTestId("visibility-modal");
  await expect(ownerModal).toBeVisible();
  await ownerModal.getByTestId("confirm-visibility").click();
  await expect(
    ownerModal.getByText("Private projects are on Team."),
  ).toBeVisible();
  // An owner's way on is the pane that can change it; the control keeps its
  // own label, because pressing it again would be refused again.
  await expect(ownerModal.getByTestId("confirm-visibility")).toHaveText(
    "Make private",
  );
  await ownerModal.getByRole("button", { name: "Open billing" }).click();
  await expect(ownerModal).toHaveCount(0);
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("Billing");

  const second = freshEmail("visibility-admin");
  const memberSession = await addMember(page, workspaceId, second, "admin");
  await switchSession(page, memberSession);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=project"),
  );
  await page.getByTestId("change-visibility").click();
  const adminModal = page.getByTestId("visibility-modal");
  await expect(adminModal).toBeVisible();
  await adminModal.getByTestId("confirm-visibility").click();
  await expect(
    adminModal.getByText("Private projects are on Team."),
  ).toBeVisible();
  await expect(adminModal.getByText(askAnOwner)).toBeVisible();
  await expect(
    adminModal.getByRole("button", { name: "Open billing" }),
  ).toHaveCount(0);
});

test("a private project back on the free plan says where it stands, on its stage and in the Workspace pane", async ({
  page,
}) => {
  const { workspaceId, projectId } = await owner(page, "downgrade");
  // Nothing is deleted and nothing is made public when Team ends: the project
  // stays private and takes no new publication. The billing webhook that ends
  // Team is the API's own lifecycle test; here the plan is written where its
  // worker writes it.
  await makePrivate(page, projectId);
  downgradeToFree(workspaceId);

  await test.step("a private stage retries an unreadable workspace", async () => {
    const workspaceRead = `**/v1/workspaces/${workspaceId}`;
    const failure = apiFailure("unavailable");
    await page.route(workspaceRead, (route) => {
      if (route.request().method() !== "GET") return route.continue();
      return route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: failure.body,
      });
    });

    await open(page, await projectPathFor(page, projectId));
    const canvas = page.locator(".fo-stage-canvas");
    await expect(
      canvas.getByText("This workspace couldn’t load"),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    await expect(canvas.getByText("Checking publishing access")).toHaveCount(0);

    await page.unroute(workspaceRead);
    await canvas.getByRole("button", { name: "Try again" }).click();
    await expect(canvas.getByText(publishingOnTeam)).toBeVisible();
  });

  await test.step("the stage of a private project on the free plan offers the way on", async () => {
    await open(page, await projectPathFor(page, projectId));
    await expect(page.getByText(publishingOnTeam)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Set up publishing" }),
    ).toHaveCount(0);
    await page.getByTestId("stage-open-billing").click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { level: 1 }),
    ).toHaveText("Billing");
  });

  await test.step("a workspace back on the free plan is told where its private project stands", async () => {
    await openDialog(
      page,
      await projectQueryPathFor(page, projectId, "settings=workspace"),
    );
    await expect(page.locator(".fo-facts").first()).toContainText("Free");
    await expect(page.getByText(publishingOnTeam + ".")).toBeVisible();
    await page.getByRole("button", { name: "Open billing" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { level: 1 }),
    ).toHaveText("Billing");
  });

  const second = freshEmail("downgrade-member");
  const memberSession = await addMember(page, workspaceId, second, "member");
  await switchSession(page, memberSession);

  await test.step("a workspace back on the free plan is told where its private project stands: a member", async () => {
    await openDialog(
      page,
      await projectQueryPathFor(page, projectId, "settings=workspace"),
    );
    await expect(page.getByText(publishingOnTeam + ".")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(askAnOwner)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open billing" }),
    ).toHaveCount(0);
  });

  await test.step("the stage of a private project on the free plan offers the way on: a member", async () => {
    await open(page, await projectPathFor(page, projectId));
    await expect(page.getByText(publishingOnTeam)).toBeVisible();
    await expect(page.getByText(askAnOwner)).toBeVisible();
    await expect(page.getByTestId("stage-open-billing")).toHaveCount(0);
  });
});

test("a project-only admin publishes on Team and never receives billing", async ({
  page,
}) => {
  const { workspaceId, projectId } = await owner(page, "direct-publishing");
  await makePrivate(page, projectId);
  const path = await projectPathFor(page, projectId);
  const ownerSession = await page.context().storageState();

  await page.context().clearCookies();
  await signIn(page, freshEmail("direct-publishing-admin"));
  const guestId = await currentUserId(page);
  const guestSession = await page.context().storageState();

  await page.context().clearCookies();
  await page.context().addCookies(ownerSession.cookies);
  await grantProject(page, projectId, guestId);
  await page.context().clearCookies();
  await page.context().addCookies(guestSession.cookies);

  await open(page, path);
  await expect(
    page.getByRole("button", { name: "Set up publishing" }),
  ).toBeVisible();
  await expect(page.getByText("This workspace couldn’t load")).toHaveCount(0);
  await expect(page.getByTestId("stage-open-billing")).toHaveCount(0);

  downgradeToFree(workspaceId);
  await open(page, path);
  await expect(page.getByText(publishingOnTeam)).toBeVisible();
  await expect(page.getByText(askAnOwner)).toBeVisible();
  await expect(page.getByTestId("stage-open-billing")).toHaveCount(0);
});
