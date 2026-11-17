import type { Page } from "@playwright/test";

import {
  expect,
  freshEmail,
  installApp,
  signIn,
  test,
  workspaceAddress,
} from "./harness";
import { createWorkspace, expectCompletedSteps } from "./setup-walks";
import { projectNameLimit } from "../screens/account/project-name";

/**
 * A project with no repository the App reads publishes with the Mokly CLI.
 * Its form takes the repository as the CLI identifies it, on any Git host,
 * and is reached from the install step and from the repository step, whose
 * way back it keeps. Every walk creates the project against the real API.
 */

/** Type a repository and wait for the address the API suggests for it. */
async function nameRepository(
  page: Page,
  repository: string,
  slug: string,
): Promise<void> {
  await page.getByLabel("Repository", { exact: true }).fill(repository);
  await expect(page.getByLabel("Project slug")).toHaveValue(slug);
}

/** Create the project and land on the finished project. */
async function createCliProject(page: Page): Promise<void> {
  await page.getByTestId("create-cli-project").click();
  await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/setup$/.test(url.pathname));
  await expect(
    page.getByRole("heading", { level: 1, name: /is ready/ }),
  ).toBeVisible();
}

test("a workspace without the App publishes with the CLI from the install step", async ({
  page,
}) => {
  await signIn(page, freshEmail("cli-install"));
  const workspaceId = await createWorkspace(page, "Cli Install Org");
  await page
    .getByRole("link", { name: "Publish with the CLI instead" })
    .click();
  const workspace = await workspaceAddress(page, workspaceId);
  await page.waitForURL(
    (url) => url.pathname === `${workspace.path}/-/new/cli`,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Publish with the CLI" }),
  ).toBeVisible();
  // Nothing is installed, so the strip claims only the workspace, and the
  // way back is the install step that offered the form.
  await expectCompletedSteps(page, ["Workspace"]);
  await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
    "href",
    `/install?workspaceId=${workspaceId}`,
  );
  await expect(page.getByLabel("Repository", { exact: true })).toHaveAttribute(
    "placeholder",
    "host/owner/name",
  );
  await expect(page.getByTestId("create-cli-project")).toBeDisabled();

  await nameRepository(page, "gitlab.com/mokly-ai/web/site", "site");
  await createCliProject(page);
  await expect(page.getByText("gitlab.com/mokly-ai/web/site")).toBeVisible();
  // A project that publishes with the CLI never builds, so the guide leads.
  await expect(page.getByTestId("publish-from-ci")).toBeVisible();
});

test("a connected workspace publishes with the CLI from the repository step", async ({
  page,
}) => {
  await signIn(page, freshEmail("cli-repository"));
  await createWorkspace(page, "Cli Repository Org");
  await installApp(page);
  const step = new URL(page.url()).pathname;
  await page
    .getByRole("link", { name: "Publish with the CLI instead" })
    .click();
  await page.waitForURL((url) => url.pathname === `${step}/cli`);
  await expectCompletedSteps(page, ["Workspace", "Install"]);
  await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
    "href",
    step,
  );

  await nameRepository(page, "mokly-ai/catalogue", "catalogue");
  await createCliProject(page);
  await expect(page.getByText("mokly-ai/catalogue")).toBeVisible();
});

test("a repository that already has a project offers the existing one", async ({
  page,
}) => {
  await signIn(page, freshEmail("cli-duplicate"));
  const workspaceId = await createWorkspace(page, "Cli Duplicate Org");
  const workspace = await workspaceAddress(page, workspaceId);
  const form = `${workspace.path}/-/new/cli`;
  await page.goto(form);
  await nameRepository(page, "codeberg.org/mokly/notes", "notes");
  await createCliProject(page);

  await page.goto(form);
  // The stored identity is lowercase and drops the clone suffix, so another
  // spelling is the same one; the address suggested for it moves past the
  // slug the first one took.
  await page
    .getByLabel("Repository", { exact: true })
    .fill("codeberg.org/Mokly/Notes.git");
  await expect(page.getByLabel("Project slug")).not.toHaveValue("");
  await expect(page.getByLabel("Project slug")).not.toHaveValue("notes");
  await page.getByTestId("create-cli-project").click();

  const recovery = page.getByRole("alert");
  await expect(recovery).toContainText(
    "This repository already has a project.",
  );
  await expect(recovery.getByRole("link", { name: "Open it" })).toHaveAttribute(
    "href",
    /^\/projects\/[0-9a-f-]{36}$/,
  );
  // Sending the same repository again would be refused the same way.
  await expect(page.getByTestId("create-cli-project")).toHaveText(
    "Create project",
  );
  await expect(page.locator(".fo-write-failure details")).toHaveCount(1);
});

test("a repository still being typed suggests no address yet", async ({
  page,
}) => {
  await signIn(page, freshEmail("cli-typing"));
  const workspaceId = await createWorkspace(page, "Cli Typing Org");
  const workspace = await workspaceAddress(page, workspaceId);
  await page.goto(`${workspace.path}/-/new/cli`);

  const refused = page.waitForResponse(
    (answer) =>
      answer.url().includes("/projects/slug-suggestion") &&
      answer.status() === 400,
  );
  await page.getByLabel("Repository", { exact: true }).fill("gitlab.com");
  await refused;
  await expect(page.getByText("Address couldn’t load")).toHaveCount(0);
  await expect(page.getByLabel("Project slug")).toHaveValue("");
  await expect(page.getByTestId("create-cli-project")).toBeDisabled();

  await nameRepository(page, "gitlab.com/mokly-ai/web/typed", "typed");
  await expect(page.getByTestId("create-cli-project")).toBeEnabled();
});

test("a repository named past the display name limit still makes a project", async ({
  page,
}) => {
  await signIn(page, freshEmail("cli-long-name"));
  const workspaceId = await createWorkspace(page, "Cli Long Name Org");
  const workspace = await workspaceAddress(page, workspaceId);
  await page.goto(`${workspace.path}/-/new/cli`);

  // One character past the display name limit, on a host that allows far
  // longer names than GitHub. Only the name is cut; the identity stays whole.
  const repository = "gitlab.com/team/" + "a".repeat(projectNameLimit + 1);
  const name = "a".repeat(projectNameLimit);
  await page.getByLabel("Repository", { exact: true }).fill(repository);
  await expect(page.getByLabel("Project slug")).not.toHaveValue("");
  const created = page.waitForResponse(
    (answer) =>
      answer.request().method() === "POST" &&
      new URL(answer.url()).pathname ===
        `/v1/workspaces/${workspaceId}/projects`,
  );
  await createCliProject(page);
  const answer = await created;
  expect(answer.request().postDataJSON()).toMatchObject({ repository, name });
  expect(answer.status()).toBe(201);
  expect(await answer.json()).toMatchObject({ repository, name });
  await expect(
    page.getByRole("heading", { level: 1, name: name + " is ready" }),
  ).toBeVisible();
  await expect(page.getByText(repository)).toBeVisible();
});
