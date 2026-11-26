import type { Page } from "@playwright/test";

import { workspaceAddress } from "./addresses";
import { apiFailure } from "./api-responses";
import { installedRepository, releaseRecordedGitHub } from "./database-fixture";
import { answerGitHubPages, startGitHubFlow } from "./github-installation";
import {
  expect,
  freshEmail,
  open,
  ready,
  signIn,
  walkSignIn,
  test,
} from "./harness";
import {
  chooseRepository,
  createProject,
  repositoryField,
} from "./project-setup";
import {
  atConnectSituation,
  atRepositoryStep,
  createWorkspace,
  expectCompletedSteps,
  statelessReturn,
} from "./setup-walks";

/**
 * An installation that arrives from GitHub with no flow behind it — Configure
 * on GitHub with Redirect on update, or an install started on GitHub — is
 * connected through the same flow a fresh installation is, with the arriving
 * installation recorded as the flow's candidate. Every walk here runs that
 * flow for real against the recorded GitHub: the API proves the reader
 * administers the account and binds the installation.
 */

/** Continue on GitHub, through GitHub's authorization page, back to Mokly. */
async function continueOnGitHub(page: Page): Promise<void> {
  await answerGitHubPages(page);
  await startGitHubFlow(page, "connect-installation");
}

test("a stateless return connects the installation to the reader's workspace", async ({
  page,
}) => {
  await signIn(page, freshEmail("connect-one"));
  const workspaceId = await createWorkspace(page, "Connect One Org");
  releaseRecordedGitHub();

  const before = await page.evaluate(() => window.history.length);
  await page.goto(statelessReturn);
  await atConnectSituation(page, 1);
  // The landing replaced its own entry: Back does not return to a landing
  // that has nothing left to finish.
  expect(await page.evaluate(() => window.history.length)).toBe(before + 1);

  // One workspace is the only place the account can go, so it is a fact.
  await expect(page.locator(".fo-facts")).toContainText("Connect One Org");
  await expect(page.getByTestId("workspace-select")).toHaveCount(0);
  await expectCompletedSteps(page, ["Workspace"]);
  await expect(
    page.getByRole("link", { name: "Publish with the CLI instead" }),
  ).toHaveCount(0);

  await continueOnGitHub(page);
  await atRepositoryStep(page);
  const workspace = await workspaceAddress(page, workspaceId);
  expect(new URL(page.url()).pathname).toBe(`${workspace.path}/-/new`);
  await chooseRepository(page);
  await expect(repositoryField(page)).toContainText(installedRepository);
});

test("a reader who administers several workspaces chooses one", async ({
  page,
}) => {
  await signIn(page, freshEmail("connect-choice"));
  await createWorkspace(page, "Choice First Org");
  const second = await createWorkspace(page, "Choice Second Org");
  releaseRecordedGitHub();

  await page.goto(statelessReturn);
  await atConnectSituation(page, 1);
  const select = page.getByLabel("Workspace", { exact: true });
  await expect(select).toContainText("Choice First Org");
  await select.click();
  await page.getByRole("option", { name: "Choice Second Org" }).click();
  await expect(select).toContainText("Choice Second Org");

  await continueOnGitHub(page);
  await atRepositoryStep(page);
  const workspace = await workspaceAddress(page, second);
  expect(new URL(page.url()).pathname).toBe(`${workspace.path}/-/new`);
});

test("a reader with no workspace makes one and the installation rides along", async ({
  page,
}) => {
  await signIn(page, freshEmail("connect-none"));
  await page.waitForURL((url) => url.pathname === "/new");
  releaseRecordedGitHub();

  await page.goto(statelessReturn);
  await atConnectSituation(page, 1);
  await expect(
    page.getByText("Create a workspace to connect this account."),
  ).toBeVisible();
  // Nobody has made a workspace yet, so the strip claims nothing.
  await expectCompletedSteps(page, []);
  await page.getByRole("button", { name: "Create a workspace" }).click();
  await page.waitForURL(
    (url) =>
      url.pathname === "/new" && url.searchParams.get("installationId") === "1",
  );

  await page.getByLabel("Workspace name").fill("Arrival Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await atConnectSituation(page, 1);
  const workspaceId = new URL(page.url()).searchParams.get("workspaceId");
  expect(workspaceId).toBeTruthy();
  await expect(page.locator(".fo-facts")).toContainText("Arrival Org");

  await continueOnGitHub(page);
  await atRepositoryStep(page);
  const workspace = await workspaceAddress(page, workspaceId ?? "");
  expect(new URL(page.url()).pathname).toBe(`${workspace.path}/-/new`);
});

test("a signed-out return signs in and comes back to the connect situation", async ({
  page,
}) => {
  await page.goto(statelessReturn);
  await page.waitForURL((url) => url.pathname === "/sign-in");
  const returnTo = new URL(page.url()).searchParams.get("returnTo");
  expect(returnTo).toBe("/install?installationId=1");

  await walkSignIn(page, freshEmail("connect-signed-out"), returnTo ?? "");
  await atConnectSituation(page, 1);
});

test("an account another workspace holds is refused with the way back", async ({
  page,
}) => {
  await signIn(page, freshEmail("connect-conflict"));
  // The first workspace installs the recorded account for real.
  await createProject(page, "Holder Org");
  const second = await createWorkspace(page, "Asker Org");

  await open(page, `/install?workspaceId=${second}&installationId=1`);
  await atConnectSituation(page, 1);
  await expect(page.locator(".fo-facts")).toContainText("Asker Org");
  await continueOnGitHub(page);

  await page.waitForURL((url) => url.pathname === "/auth/github/callback");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "This GitHub account is connected to another workspace",
    }),
  ).toBeVisible();
  const refusal = page.getByRole("alert");
  await expect(refusal).toHaveText(/Remove it from that workspace first\./);
  await expect(refusal.locator("details")).toHaveCount(1);
  // `/install` opens the first workspace, Holder Org, and its account is
  // connected, so the install step hands the reader straight on to its
  // repository step. The wait starts before the press, so it sees the
  // address that the press opens however soon that hand-on follows.
  const backToInstall = page.waitForURL((url) => url.pathname === "/install");
  await page.getByRole("button", { name: "Back to install" }).click();
  await backToInstall;
});

test("the connect situation says when the workspaces could not load", async ({
  page,
}) => {
  await signIn(page, freshEmail("connect-unread"));
  await createWorkspace(page, "Unread Org");
  let reads = 0;
  await page.route(
    (url) => url.pathname === "/v1/workspaces",
    (route) => {
      if (route.request().method() !== "GET" || reads > 0) {
        return route.continue();
      }
      reads += 1;
      const failure = apiFailure("unavailable");
      return route.fulfill({
        status: failure.status,
        contentType: "application/json",
        body: failure.body,
      });
    },
  );

  await page.goto("/install?installationId=1");
  await ready(page);
  const failed = page.getByRole("alert");
  await expect(failed).toContainText("Workspaces couldn’t load");
  await expect(failed.locator("details")).toHaveCount(1);
  await expectCompletedSteps(page, []);
  await page.getByTestId("retry-workspaces").click();
  await expect(page.locator(".fo-facts")).toContainText("Unread Org");
  await page.unrouteAll();
});
