import type { Page } from "@playwright/test";

import { createWorkspacePath, installPath } from "../navigation/paths";

import {
  bindAnotherInstallation,
  installedRepository,
  manageUrl,
  releaseSecondInstallation,
  secondInstallation,
} from "./database-fixture";
import {
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  open,
  workspaceAddress,
  repositoryField,
  signIn,
  test,
} from "./harness";
import { atRepositoryStep, installSecondAccount } from "./setup-walks";

/**
 * The repository step of a reader in two workspaces that both installed the
 * App.
 *
 * The installation list answers for every workspace the reader belongs to,
 * but a project is created from its own workspace's installation, and the
 * API refuses a repository from another one. So the step lists only the open
 * workspace's repositories and links to that workspace's installation.
 */

// The first walk binds the second recorded installation; it is handed back
// after each walk, so the next one can bind it again.
test.afterEach(() => releaseSecondInstallation());

/** Open one workspace's repository step and check what its select offers. */
async function expectOffered(
  page: Page,
  workspacePath: string,
  repository: string,
  installation: string,
): Promise<void> {
  await open(page, `${workspacePath}/-/new`);
  await repositoryField(page).click();
  const options = page.getByRole("option");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText(repository);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "Manage repository access" }),
  ).toHaveAttribute("href", installation);
}

/** Create another workspace through the workspace step; answer its ID. */
async function createWorkspace(page: Page, name: string): Promise<string> {
  await open(page, createWorkspacePath);
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === installPath);
  const id = new URL(page.url()).searchParams.get("workspaceId");
  if (!id) throw new Error("the install step names no workspace");
  return id;
}

test("the repository step lists only its own workspace's installation", async ({
  page,
}) => {
  await signIn(page, freshEmail("two-installations"));
  await createProject(page, "First Install Org");
  const first = await workspaceAddress(page, await currentWorkspaceId(page));

  const secondId = await createWorkspace(page, "Second Install Org");
  await installSecondAccount(page, "install-app");
  await atRepositoryStep(page);
  const secondAddress = await workspaceAddress(page, secondId);

  await expectOffered(
    page,
    secondAddress.path,
    secondInstallation.repository,
    secondInstallation.manageUrl,
  );
  await expectOffered(page, first.path, installedRepository, manageUrl);
});

test("the repository step lists every page of the installation's repositories", async ({
  page,
}) => {
  // One more repository than the API's page holds, so a list that stopped at
  // the first page would leave one out.
  await signIn(page, freshEmail("many-repositories"));
  const workspaceId = await createWorkspace(page, "Many Repos Org");
  const repositories = Array.from(
    { length: 51 },
    (_, index) => `mokly-ai/many-${String(index + 1).padStart(2, "0")}`,
  );
  bindAnotherInstallation(workspaceId, repositories);
  const address = await workspaceAddress(page, workspaceId);

  await open(page, `${address.path}/-/new`);
  await repositoryField(page).click();
  await expect(page.getByRole("option")).toHaveCount(51);
});
