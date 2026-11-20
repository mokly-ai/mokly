import { workspaceSettingsPathFor } from "./addresses";
import {
  installedAccount,
  releaseSecondInstallation,
  secondInstallation,
} from "./database-fixture";
import { installApp } from "./github-installation";
import { expect, freshEmail, open, signIn, test } from "./harness";
import {
  addSecondAccount,
  createWorkspace,
  githubAccountRow,
} from "./setup-walks";

/**
 * On a phone the GitHub accounts pane is a full-screen route, so with two
 * connected accounts Manage repository access leads to that route, and the
 * flow that adds the second account returns to it.
 */

test.afterEach(() => releaseSecondInstallation());

test("on a phone, Manage repository access opens the GitHub accounts route for two accounts", async ({
  page,
}) => {
  await signIn(page, freshEmail("two-accounts-phone"));
  const workspaceId = await createWorkspace(page, "Two Accounts Phone Org");
  await installApp(page);
  const step = new URL(page.url()).pathname;
  const route = await workspaceSettingsPathFor(page, workspaceId, "github");

  await addSecondAccount(page, workspaceId);
  expect(new URL(page.url()).pathname).toBe(route);

  await open(page, step);
  await page.getByRole("link", { name: "Manage repository access" }).click();
  await page.waitForURL((url) => url.pathname === route);
  await expect(
    page.getByRole("heading", { level: 1, name: "GitHub accounts" }),
  ).toBeVisible();
  for (const account of [installedAccount, secondInstallation.account])
    await expect(githubAccountRow(page, account)).toBeVisible();
});
