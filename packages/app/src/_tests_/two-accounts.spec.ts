import type { Page } from "@playwright/test";

import {
  installedAccount,
  installedRepository,
  releaseSecondInstallation,
  secondInstallation,
} from "./database-fixture";
import { installApp } from "./github-installation";
import { expect, freshEmail, signIn, test } from "./harness";
import { chooseRepository, repositoryField } from "./project-setup";
import {
  addSecondAccount,
  atRepositoryStep,
  createWorkspace,
  githubAccountRow,
} from "./setup-walks";

/**
 * A workspace that connects two GitHub accounts, both installed for real: the
 * recorded account from the install step, and the second recorded account, an
 * organization, from the GitHub accounts pane. With two accounts the
 * repository step groups its select by account, and Manage repository access
 * opens the pane, which holds one manage link for each account.
 */

test.afterEach(() => releaseSecondInstallation());

/**
 * The open select's sections, in the order it lists them: each section's
 * title, then the name of every option beneath it. A title is text outside
 * any option; an option's name is the first text inside it, before its
 * visibility.
 */
async function selectSections(page: Page): Promise<string[][]> {
  return page.getByRole("listbox").evaluate((list) => {
    const texts = [...list.querySelectorAll("*")].filter(
      (element) => element.children.length === 0 && element.textContent?.trim(),
    );
    const sections: string[][] = [];
    for (const text of texts) {
      const option = text.closest("[role='option']");
      const name = text.textContent?.trim() ?? "";
      if (option === null) sections.push([name]);
      else if (texts.find((other) => option.contains(other)) === text)
        sections.at(-1)?.push(name);
    }
    return sections;
  });
}

test("two connected accounts group the repository select and share the GitHub accounts pane", async ({
  page,
}) => {
  await signIn(page, freshEmail("two-accounts"));
  const workspaceId = await createWorkspace(page, "Two Accounts Org");
  await installApp(page);
  const step = new URL(page.url()).pathname;

  // The workspace has no project yet, so the pane opens over its next step.
  await addSecondAccount(page, workspaceId);
  expect(new URL(page.url()).pathname).toBe(step);
  await expect(githubAccountRow(page, installedAccount)).toContainText(
    "Personal",
  );
  await expect(
    githubAccountRow(page, secondInstallation.account),
  ).toContainText("Organization");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await atRepositoryStep(page);

  await repositoryField(page).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  // Each repository sits beneath its own account's title; the API's list
  // order decides which account comes first.
  const sections = await selectSections(page);
  expect(sections).toHaveLength(2);
  expect(sections).toEqual(
    expect.arrayContaining([
      [installedAccount, installedRepository],
      [secondInstallation.account, secondInstallation.repository],
    ]),
  );
  await page.keyboard.press("Escape");

  // Two accounts have no one page on GitHub, so the link opens the pane.
  const manage = page.getByRole("link", { name: "Manage repository access" });
  await expect(manage).not.toHaveAttribute("target", "_blank");
  await manage.click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("GitHub accounts");
  const address = new URL(page.url());
  expect(address.pathname).toBe(step);
  expect(address.searchParams.get("settings")).toBe("github");
  for (const account of [installedAccount, secondInstallation.account])
    await expect(githubAccountRow(page, account)).toBeVisible();
});

/** Remove one account through its row menu on the open GitHub accounts pane. */
async function removeAccount(page: Page, account: string): Promise<void> {
  await page.getByRole("button", { name: "Actions for " + account }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await page.getByTestId("confirm-remove-github-account").click();
}

test("removing an account keeps the repository step's answers and the pane over it", async ({
  page,
}) => {
  await signIn(page, freshEmail("two-accounts-remove"));
  const workspaceId = await createWorkspace(page, "Two Accounts Remove Org");
  await installApp(page);
  const step = new URL(page.url()).pathname;
  await addSecondAccount(page, workspaceId);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await atRepositoryStep(page);

  await chooseRepository(page);
  const configPath = page.getByLabel("Config path");
  const slug = page.getByLabel("Project slug");
  const create = page.getByTestId("create-project");
  await configPath.fill("custom/mokly.config.json");
  await slug.fill("kept-address");
  await expect(create).toBeEnabled();

  // The removal refreshes every read of the workspace. The installation list
  // is held until the step has been seen mid-refresh: still on screen with the
  // reader's answers, and unable to send a repository the removal may take.
  let holding = false;
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) =>
      url.pathname === "/v1/github/installations" &&
      url.searchParams.has("workspaceId"),
    async (route) => {
      if (holding && route.request().method() === "GET") await held;
      await route.continue();
    },
  );
  await page.getByRole("link", { name: "Manage repository access" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toHaveText("GitHub accounts");
  holding = true;
  await removeAccount(page, secondInstallation.account);
  await expect(create).toBeDisabled();
  await expect(configPath).toHaveValue("custom/mokly.config.json");
  await expect(slug).toHaveValue("kept-address");
  release();
  await expect(githubAccountRow(page, secondInstallation.account)).toHaveCount(
    0,
  );
  await expect(githubAccountRow(page, installedAccount)).toBeVisible();
  // Read again, the step beneath the pane holds every answer, and the chosen
  // repository is one the remaining account still grants.
  expect(new URL(page.url()).pathname).toBe(step);
  await expect(repositoryField(page)).toContainText(installedRepository);
  await expect(configPath).toHaveValue("custom/mokly.config.json");
  await expect(slug).toHaveValue("kept-address");
  await expect(create).toBeEnabled();

  // Removing the last account hands the step back to the install step, and
  // the pane stays open over it to say the workspace has none.
  await removeAccount(page, installedAccount);
  await page.waitForURL(
    (url) =>
      url.pathname === "/install" &&
      url.searchParams.get("workspaceId") === workspaceId &&
      url.searchParams.get("settings") === "github",
  );
  const pane = page.getByRole("dialog");
  await expect(pane.getByRole("heading", { level: 1 })).toHaveText(
    "GitHub accounts",
  );
  await expect(pane.getByText("No GitHub accounts yet")).toBeVisible();
  await expect(page.getByTestId("add-github-account")).toBeVisible();
});
