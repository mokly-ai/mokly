import type { Page } from "@playwright/test";

import { createWorkspacePath, installPath } from "../navigation/paths";

import { workspaceSettingsPathFor } from "./addresses";
import { secondInstallation } from "./database-fixture";
import { answerGitHubPages, startGitHubFlow } from "./github-installation";
import { expect, open, ready } from "./harness";

/**
 * GitHub's setup return with no flow behind it, as Redirect on update sends it
 * after Configure on GitHub, for the recorded installation.
 */
export const statelessReturn =
  "/auth/github/install?installation_id=1&setup_action=update";

/**
 * Create one more workspace through the workspace step and answer its ID,
 * which the install step the step hands on to names.
 */
export async function createWorkspace(
  page: Page,
  name: string,
): Promise<string> {
  await open(page, createWorkspacePath);
  await page.getByLabel("Workspace name").fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === installPath);
  const id = new URL(page.url()).searchParams.get("workspaceId");
  if (!id) throw new Error("the install step names no workspace");
  return id;
}

/** Wait until the address is the connect situation for one installation. */
export async function atConnectSituation(
  page: Page,
  installationId: number,
): Promise<void> {
  await page.waitForURL(
    (url) =>
      url.pathname === installPath &&
      url.searchParams.get("installationId") === String(installationId),
  );
  await ready(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Connect a GitHub account" }),
  ).toBeVisible();
}

/** Wait until the address is one workspace's repository step. */
export async function atRepositoryStep(page: Page): Promise<void> {
  await page.waitForURL((url) => /^\/[^/]+\/-\/new$/.test(url.pathname));
  await ready(page);
}

/** Wait for the setup strip and the steps the reader is credited with. */
export async function expectCompletedSteps(
  page: Page,
  steps: readonly string[],
): Promise<void> {
  const progress = page.getByRole("list", { name: "Setup progress" });
  await expect(progress).toBeVisible();
  await expect(progress.locator("li[data-complete='true']")).toHaveText(
    steps.map((step) => `✓${step}`),
  );
}

/** One account's row on the GitHub accounts pane, in the dialog or the route. */
export function githubAccountRow(page: Page, account: string) {
  return page
    .locator("[data-testid^='github-account-']")
    .filter({ hasText: account });
}

/**
 * Install the App on the second account the recorded GitHub serves, from the
 * control that starts an installation: the same real exchange as the first,
 * with GitHub's setup page returning the second installation. A walk that
 * binds it hands it back when it ends, with `releaseSecondInstallation`.
 */
export async function installSecondAccount(
  page: Page,
  control: string,
): Promise<void> {
  await answerGitHubPages(page, secondInstallation.id);
  await startGitHubFlow(page, control);
}

/**
 * Connect the second account to a workspace from its GitHub accounts pane,
 * through Add GitHub account, and wait until the pane the flow returns to
 * lists it. The pane's durable route is the dialog over the workspace's
 * working page on a wide surface and the full-screen route on a phone.
 */
export async function addSecondAccount(
  page: Page,
  workspaceId: string,
): Promise<void> {
  await open(page, await workspaceSettingsPathFor(page, workspaceId, "github"));
  await expect(
    page.getByRole("heading", { level: 1, name: "GitHub accounts" }),
  ).toBeVisible();
  await installSecondAccount(page, "add-github-account");
  await expect(
    githubAccountRow(page, secondInstallation.account),
  ).toBeVisible();
}
