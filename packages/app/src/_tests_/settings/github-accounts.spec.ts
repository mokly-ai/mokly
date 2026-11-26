import type { Page } from "@playwright/test";

import { projectQueryPathFor } from "../addresses";
import { apiFailure } from "../api-responses";
import {
  installedAccount,
  manageUrl,
  releaseRecordedGitHub,
  suspendInstallation,
} from "../database-fixture";
import { answerGitHubPages, startGitHubFlow } from "../github-installation";
import {
  currentWorkspaceId,
  expect,
  freshEmail,
  openDialog,
  signIn,
  test,
} from "../harness";
import { addMember, switchSession } from "../members";
import { createProject } from "../project-setup";

/**
 * The GitHub accounts pane lists every account the workspace connects. Owners
 * and admins act on each one from its row menu and add another; every other
 * member reads the rows. Each walk binds the recorded account for real by
 * creating a project, and reads the pane back from the API.
 */

/** A project's workspace with the recorded account bound, and the pane open. */
async function paneWithAccount(page: Page, label: string): Promise<string> {
  await signIn(page, freshEmail(label));
  const projectId = await createProject(page, label + " Org");
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=github"),
  );
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("GitHub accounts");
  return projectId;
}

/** The recorded account's own row. */
function accountRow(page: Page) {
  return page
    .getByRole("dialog")
    .locator("[data-testid^='github-account-']")
    .filter({ hasText: installedAccount });
}

/** Open one row's three-dot menu. */
async function openRowMenu(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: "Actions for " + installedAccount })
    .click();
}

test("the pane lists the connected account with its own actions", async ({
  page,
}) => {
  await paneWithAccount(page, "github-pane");
  await expect(
    page.getByRole("heading", { name: "Connected accounts" }),
  ).toBeVisible();
  const row = accountRow(page);
  await expect(row).toContainText("Personal");
  // A connected account needs no state word.
  await expect(row).not.toContainText("Suspended");
  await expect(row.getByRole("link", { name: "Resume on GitHub" })).toHaveCount(
    0,
  );
  await expect(page.getByTestId("add-github-account")).toBeVisible();

  await openRowMenu(page);
  await expect(
    page.getByRole("menuitem", { name: "Manage on GitHub" }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Remove" })).toBeVisible();
});

test("Manage on GitHub opens the installation's page beside the pane", async ({
  page,
}) => {
  await paneWithAccount(page, "github-manage");
  // GitHub's own page is not the suite's to load; the address is the point.
  await page
    .context()
    .route("https://github.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "" }),
    );
  await openRowMenu(page);
  const opened = page.context().waitForEvent("page");
  await page.getByRole("menuitem", { name: "Manage on GitHub" }).click();
  const beside = await opened;
  await beside.waitForLoadState();
  expect(beside.url()).toBe(manageUrl);
  await expect(page.getByRole("dialog")).toBeVisible();
  await beside.close();
});

test("Remove disconnects the account, and Add GitHub account installs one again", async ({
  page,
}) => {
  const projectId = await paneWithAccount(page, "github-remove");
  await test.step("Remove disconnects the account and the pane offers to add one", async () => {
    await openRowMenu(page);
    await page.getByRole("menuitem", { name: "Remove" }).click();
    const modal = page.getByTestId("remove-github-account-modal");
    await expect(modal).toContainText("Remove " + installedAccount + "?");
    await expect(modal).toContainText(
      "Mokly stops reading its repositories. Its projects and publications stay.",
    );

    // Cancel keeps the account and lands back on its row.
    await page.getByTestId("cancel-remove-github-account").click();
    await expect(modal).toHaveCount(0);
    await expect(accountRow(page)).toBeVisible();

    await openRowMenu(page);
    await page.getByRole("menuitem", { name: "Remove" }).click();
    const removed = page.waitForResponse(
      (answer) =>
        answer.request().method() === "DELETE" &&
        answer.url().includes("/v1/github/installations/"),
    );
    await page.getByTestId("confirm-remove-github-account").click();
    expect((await removed).status()).toBe(204);
    await expect(page.getByText("No GitHub accounts yet")).toBeVisible();
    await expect(page.getByTestId("add-github-account")).toBeVisible();

    // The workspace keeps its project and reads its accounts as none.
    await page.getByRole("link", { name: "Workspace", exact: true }).click();
    await expect(page.getByTestId("github-accounts-fact")).toContainText(
      "None",
    );
    await expect(page.getByRole("dialog")).toContainText("Projects");
    // Installing is still the way on: Create project offers the install step.
    await expect(
      page.getByRole("button", { name: "Create project" }),
    ).toBeVisible();
  });

  await test.step("Add GitHub account installs through GitHub and returns to the pane", async () => {
    await page
      .getByRole("link", { name: "GitHub accounts", exact: true })
      .click();
    await expect(page.getByText("No GitHub accounts yet")).toBeVisible();

    releaseRecordedGitHub();
    await answerGitHubPages(page);
    await startGitHubFlow(page, "add-github-account");
    // The pane's own route is the flow's return, which the desktop opens as the
    // dialog over the workspace's project.
    await page.waitForURL(
      (url) => url.searchParams.get("settings") === "github",
    );
    await expect(accountRow(page)).toBeVisible();
    expect(new URL(page.url()).pathname).not.toContain("/-/settings");
    expect(projectId.length).toBeGreaterThan(0);
  });
});

test("a suspended account says so beside the way to resume it", async ({
  page,
}) => {
  await signIn(page, freshEmail("github-suspended"));
  const projectId = await createProject(page, "Github Suspended Org");
  suspendInstallation(await currentWorkspaceId(page));
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=github"),
  );
  const row = accountRow(page);
  await expect(row).toContainText("Suspended");
  const resume = row.getByRole("link", { name: "Resume on GitHub" });
  await expect(resume).toHaveAttribute("href", manageUrl);
  // Somebody else's page, so it opens beside this one.
  await expect(resume).toHaveAttribute("target", "_blank");
  await expect(resume).toHaveAttribute("rel", "noopener noreferrer");
});

test("a member reads the accounts in both panes and is offered no action", async ({
  page,
}) => {
  await signIn(page, freshEmail("github-member-owner"));
  const projectId = await createProject(page, "Github Member Org");
  const email = freshEmail("github-member");
  const memberSession = await addMember(
    page,
    await currentWorkspaceId(page),
    email,
    "member",
  );
  await switchSession(page, memberSession);
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=github"),
  );
  await test.step("a member reads the accounts and is offered no action", async () => {
    await expect(accountRow(page)).toContainText("Personal");
    await expect(
      page.getByRole("button", { name: "Actions for " + installedAccount }),
    ).toHaveCount(0);
    await expect(page.getByTestId("add-github-account")).toHaveCount(0);
  });

  await test.step("a member reads the accounts without the way to manage them", async () => {
    await openDialog(
      page,
      await projectQueryPathFor(page, projectId, "settings=workspace"),
    );
    const fact = page.getByRole("dialog").getByTestId("github-accounts-fact");
    await expect(fact).toContainText(installedAccount);
    await expect(fact.getByRole("button", { name: "Manage" })).toHaveCount(0);
  });
});

test("the pane says when the accounts could not load", async ({ page }) => {
  await signIn(page, freshEmail("github-unread"));
  const projectId = await createProject(page, "Github Unread Org");
  let failing = true;
  await page.route(
    (url) => url.pathname === "/v1/github/installations",
    (route) => {
      if (route.request().method() !== "GET" || !failing) {
        return route.continue();
      }
      const failure = apiFailure("unavailable");
      return route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: failure.body,
      });
    },
  );
  await openDialog(
    page,
    await projectQueryPathFor(page, projectId, "settings=github"),
  );
  const failed = page.getByRole("dialog").getByRole("alert");
  await expect(failed).toContainText("GitHub accounts couldn’t load");
  await expect(failed.locator("details")).toHaveCount(1);
  failing = false;
  await failed.getByRole("button", { name: "Try again" }).click();
  await expect(accountRow(page)).toBeVisible();
  await page.unrouteAll();
});
