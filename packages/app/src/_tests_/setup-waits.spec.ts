import type { Page } from "@playwright/test";

import { installApp } from "./github-installation";
import { expect, freshEmail, signIn, test } from "./harness";
import { repositoryField } from "./project-setup";
import { expectCompletedSteps } from "./setup-walks";

/**
 * Every setup step draws its own layout while a read it needs runs: the
 * session read, its route's read and its own. The wait names the read once,
 * in a place whose text the answer decides, or for screen readers only, and a
 * link whose address the answer decides waits as its words. Each read is held
 * here until its wait has been seen.
 */

/** Hold the first GET the predicate matches until the test lets it go. */
async function holdRead(page: Page, matches: (url: URL) => boolean) {
  const gate = Promise.withResolvers<void>();
  const arrived = Promise.withResolvers<void>();
  let held = false;
  await page.route(matches, async (route) => {
    if (held || route.request().method() !== "GET") return route.fallback();
    held = true;
    arrived.resolve();
    await gate.promise;
    return route.fallback();
  });
  return { arrived: arrived.promise, release: () => gate.resolve() };
}

/** The wait's name for screen readers, inside the screen's own landmark. */
function heardName(page: Page) {
  return page.getByRole("main").getByRole("status");
}

/** The line under the panel that leads to the CLI form. */
const cliLine = "Publish with the CLI instead";

test("every setup step waits in its own layout", async ({ page }) => {
  await signIn(page, freshEmail("setup-waits"));
  await page.waitForURL((url) => url.pathname === "/new");

  // The session read draws the workspace step's own form.
  const session = await holdRead(page, (url) => url.pathname === "/v1/session");
  await page.reload();
  await session.arrived;
  await expect(
    page.getByRole("heading", { level: 1, name: "Create a workspace" }),
  ).toBeVisible();
  await expect(heardName(page)).toHaveText("Opening Mokly…");
  await expect(page.getByLabel("Workspace name")).toBeVisible();
  await expect(page.getByLabel("Workspace name")).not.toBeEditable();
  await expect(
    page.getByRole("button", { name: "Create workspace" }),
  ).toBeDisabled();
  await expectCompletedSteps(page, []);
  session.release();
  await expect(page.getByLabel("Workspace name")).toBeEditable();

  // The install step's workspace read names itself under the title.
  await page.getByLabel("Workspace name").fill("Waits Org");
  const workspace = await holdRead(page, (url) =>
    /^\/v1\/workspaces\/[0-9a-f-]{36}$/.test(url.pathname),
  );
  await page.getByTestId("create-workspace").click();
  await workspace.arrived;
  await expect(
    page.getByRole("heading", { level: 1, name: "Install the Mokly app" }),
  ).toBeVisible();
  await expect(page.getByText("Loading your workspace…")).toBeVisible();
  await expect(page.getByText(cliLine)).toBeVisible();
  await expect(page.getByRole("link", { name: cliLine })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
  await expectCompletedSteps(page, ["Workspace"]);
  workspace.release();
  await expect(
    page.getByText("Choose the repositories Mokly can read."),
  ).toBeVisible();
  const installStep = page.url();

  // The CLI form's workspace read decides the address, so the address line
  // names it.
  const form = await holdRead(page, (url) =>
    /^\/v1\/workspaces\/by-slug\/[^/]+$/.test(url.pathname),
  );
  await page.getByRole("link", { name: cliLine }).click();
  await form.arrived;
  await expect(
    page.getByRole("heading", { level: 1, name: "Publish with the CLI" }),
  ).toBeVisible();
  await expect(page.locator(".fo-address-preview")).toContainText(
    "Loading your workspace…",
  );
  const repository = page.getByLabel("Repository", { exact: true });
  await expect(repository).toBeVisible();
  await expect(repository).not.toBeEditable();
  await expect(
    page.getByRole("button", { name: "Create project" }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
  form.release();
  await expect(repository).toBeEditable();

  // The finished project waits for itself, then for its default branch.
  await repository.fill("gitlab.com/mokly-ai/waits");
  await expect(page.getByLabel("Project slug")).toHaveValue("waits");
  const project = await holdRead(page, (url) =>
    /^\/v1\/workspaces\/by-slug\/[^/]+\/projects\/[^/]+$/.test(url.pathname),
  );
  const branch = await holdRead(page, (url) =>
    /^\/v1\/projects\/[0-9a-f-]{36}\/branches$/.test(url.pathname),
  );
  await page.getByTestId("create-cli-project").click();
  await project.arrived;
  // Its heading is the project's own name, so it holds a bar that screen
  // readers skip and the read's one name, which they hear as the heading.
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveCount(1);
  await expect(title).toHaveAccessibleName("Opening your project…");
  await expect(page.getByText("Opening your project…")).toHaveCount(1);
  await expect(page.getByText("Visibility")).toBeVisible();
  project.release();
  await branch.arrived;
  await expect(
    page.getByRole("heading", { level: 1, name: "waits is ready" }),
  ).toBeVisible();
  await expect(page.getByText("gitlab.com/mokly-ai/waits")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open project" })).toHaveCount(
    0,
  );
  branch.release();
  await expect(page.getByTestId("publish-from-ci")).toBeVisible();

  // The repository step's own read names itself in the Repository field.
  await page.goto(installStep);
  const repositories = await holdRead(
    page,
    (url) =>
      url.pathname === "/v1/github/installations" &&
      url.searchParams.has("workspaceId"),
  );
  await installApp(page);
  await repositories.arrived;
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose a repository" }),
  ).toBeVisible();
  await expect(repositoryField(page)).toBeVisible();
  await expect(page.getByText("Loading repositories…")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create project" }),
  ).toBeDisabled();
  await expect(page.getByText(cliLine)).toBeVisible();
  await expect(page.getByRole("link", { name: cliLine })).toHaveCount(0);
  repositories.release();
  await expect(page.getByRole("link", { name: cliLine })).toBeVisible();

  // The connect situation's workspaces read names itself in the select.
  const workspaces = await holdRead(
    page,
    (url) => url.pathname === "/v1/workspaces",
  );
  await page.goto("/install?installationId=1");
  await workspaces.arrived;
  await expect(
    page.getByRole("heading", { level: 1, name: "Connect a GitHub account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Workspace", { exact: true })).toBeVisible();
  await expect(page.getByText("Loading your workspaces…")).toBeVisible();
  await expectCompletedSteps(page, []);
  workspaces.release();
  await expect(page.getByLabel("Workspace", { exact: true })).toContainText(
    "Waits Org",
  );
});
