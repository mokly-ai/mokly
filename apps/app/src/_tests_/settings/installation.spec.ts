import type { Page } from "@playwright/test";

import {
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  openDialog,
  projectQueryPathFor,
  signIn,
  test,
} from "../harness";
import {
  disconnectInstallation,
  installedAccount,
  suspendInstallation,
} from "../database-fixture";
import { addMember, switchSession } from "../members";

/**
 * What the Workspace pane says about the GitHub accounts it connects.
 *
 * The pane names the accounts in one fact and leaves acting on them to the
 * GitHub accounts pane, which owners and admins reach from the fact. Each
 * state is a provider observation rather than anything an endpoint creates,
 * so it is planted where reconciliation would put it and read back through
 * the real API.
 */

/** The fact the open pane draws for the workspace's accounts. */
function accountsFact(page: Page) {
  return page.getByRole("dialog").getByTestId("github-accounts-fact");
}

/** The Workspace pane over the project the walk just created. */
async function workspacePane(page: Page, projectId: string): Promise<void> {
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=workspace"),
  );
}

test("a connected account is named, with the way to the accounts", async ({
  page,
}) => {
  await signIn(page, freshEmail("connected-pane"));
  // Creating the project installed the App, so the pane reads what that left.
  const projectId = await createProject(page, "Conn Org");
  await workspacePane(page, projectId);
  await expect(page.getByRole("dialog").locator(".fo-facts")).toContainText(
    "GitHub accounts",
  );
  await expect(accountsFact(page)).toContainText(installedAccount);
  await expect(accountsFact(page)).not.toContainText("Suspended");
  // Acting on an account is the GitHub accounts pane's, so this pane draws
  // no install control or recovery link of its own.
  await expect(
    page.getByRole("button", { name: "Manage installation" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Resume on GitHub" }),
  ).toHaveCount(0);

  await accountsFact(page).getByRole("button", { name: "Manage" }).click();
  await expect(page).toHaveURL(/settings=github/);
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("GitHub accounts");
});

test("a suspended account says so in the fact", async ({ page }) => {
  await signIn(page, freshEmail("suspended-pane"));
  const projectId = await createProject(page, "Susp Org");
  suspendInstallation(await currentWorkspaceId(page));
  await workspacePane(page, projectId);
  await expect(accountsFact(page)).toContainText(
    installedAccount + " · Suspended",
  );
});

test("a workspace with no account reads None", async ({ page }) => {
  await signIn(page, freshEmail("absent-pane"));
  const projectId = await createProject(page, "Abs Org");
  // The App was installed to create the project, and then removed on GitHub,
  // which is the only way a workspace with a project has nothing bound.
  disconnectInstallation(await currentWorkspaceId(page));
  await workspacePane(page, projectId);
  await expect(accountsFact(page)).toContainText("None");
  // Installing is still the way on: Create project offers the install step.
  await expect(
    page.getByRole("button", { name: "Create project" }),
  ).toBeVisible();
});

test("a member reads the accounts without the way to manage them", async ({
  page,
}) => {
  await signIn(page, freshEmail("member-pane-owner"));
  const projectId = await createProject(page, "Member Pane Org");
  const email = freshEmail("member-pane");
  const memberSession = await addMember(
    page,
    await currentWorkspaceId(page),
    email,
    "member",
  );
  await switchSession(page, memberSession);
  await workspacePane(page, projectId);
  await expect(accountsFact(page)).toContainText(installedAccount);
  await expect(
    accountsFact(page).getByRole("button", { name: "Manage" }),
  ).toHaveCount(0);
});
