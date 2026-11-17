import {
  chooseRepository,
  createProject,
  currentWorkspaceId,
  expect,
  freshEmail,
  installApp,
  open,
  workspaceAddress,
  projectPathFor,
  repositoryField,
  signIn,
  test,
} from "./harness";
import type { ApiBody } from "./harness";
import { installedRepository, manageUrl } from "./database-fixture";
import type { Page } from "@playwright/test";

test("onboarding creates a workspace and a project from a repository", async ({
  page,
}) => {
  const email = freshEmail("onboard");
  await signIn(page, email);
  const projectId = await createProject(page, "Folio Team");
  expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /is ready/ }),
  ).toBeVisible();
  await expect(page.getByText(installedRepository)).toBeVisible();
  await expect(page.getByText("mokly.config.json")).toBeVisible();
  const canonical = await projectPathFor(page, projectId);
  await page.getByRole("button", { name: "Open project" }).click();
  await page.waitForURL((url) => url.pathname === canonical);
});

test("a workspace with nothing installed is sent to the install step", async ({
  page,
}) => {
  await signIn(page, freshEmail("unbound"));
  await page.waitForURL((url) => url.pathname === "/new");
  await page.getByLabel("Workspace name").fill("Unbound Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === "/install");
  const workspaceId = await currentWorkspaceId(page);

  // The repository step is not a way past the installation: asking for it
  // directly lands on the step that makes one.
  const workspace = await workspaceAddress(page, workspaceId);
  await open(page, `${workspace.path}/-/new`);
  await page.waitForURL((url) => url.pathname === "/install");
  await expect(page.getByTestId("install-app")).toBeVisible();
});

test("a workspace that has installed is not asked to install again", async ({
  page,
}) => {
  await signIn(page, freshEmail("bound"));
  await createProject(page, "Bound Org");
  const workspaceId = await currentWorkspaceId(page);

  const workspace = await workspaceAddress(page, workspaceId);
  await open(page, `/install?workspaceId=${workspaceId}`);
  await page.waitForURL((url) => url.pathname === `${workspace.path}/-/new`);
  await expect(page.getByTestId("install-app")).toHaveCount(0);
});

test("the repository step lists what the App reads and where to change it", async ({
  page,
}) => {
  await atRepositoryStep(page, "listed");

  // Somebody else's page, so it opens beside this one rather than taking the
  // reader out of the step they are on.
  const manage = page.getByRole("link", { name: "Manage repository access" });
  await expect(manage).toHaveAttribute("href", manageUrl);
  await expect(manage).toHaveAttribute("target", "_blank");
  await expect(manage).toHaveAttribute("rel", "noopener noreferrer");

  await expect(page.getByTestId("create-project")).toBeDisabled();
  await chooseRepository(page);
  await expect(page.getByTestId("create-project")).toBeEnabled();
  await expect(repositoryField(page)).toContainText(installedRepository);
});

test("a repository that already has a project offers the existing one", async ({
  page,
}) => {
  await signIn(page, freshEmail("duplicate"));
  const projectId = await createProject(page, "Dup Org");
  const workspaceId = await currentWorkspaceId(page);
  const workspace = await workspaceAddress(page, workspaceId);
  await open(page, `${workspace.path}/-/new`);
  await chooseRepository(page);
  await page.getByRole("button", { name: "Create project" }).click();
  const recovery = page.getByRole("alert");
  await expect(recovery).toContainText("already has a project");
  await expect(recovery.getByRole("link", { name: "Open it" })).toHaveAttribute(
    "href",
    `/projects/${projectId}`,
  );
  // The way on is the project that already exists, so the control is not
  // offered as a way back: sending the same repository is the same refusal.
  await expect(page.getByTestId("create-project")).toHaveText("Create project");
});

test("the setup strip reads three steps on every step screen", async ({
  page,
}) => {
  await signIn(page, freshEmail("three-steps"));
  await page.waitForURL((url) => url.pathname === "/new");
  const steps = page.locator(".fo-steps > li");
  const position = page.locator(".fo-step-count-label");

  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(0)).toContainText("Workspace");
  await expect(position).toContainText("Step 1 of 3");

  await page.getByLabel("Workspace name").fill("Three Org");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === "/install");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(1)).toContainText("Install");
  await expect(position).toContainText("Step 2 of 3");
  // The workspace exists now, so the step that made it is the one ticked.
  await expect(steps.nth(0)).toHaveAttribute("data-complete", "true");
  await expect(steps.nth(1)).not.toHaveAttribute("data-complete", "true");

  await installApp(page);
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(2)).toHaveAttribute("aria-current", "step");
  await expect(steps.nth(2)).toContainText("Repository");
  await expect(position).toContainText("Step 3 of 3");
  // The App is installed now, so the step that installed it is ticked too: a
  // tick is an assertion about the account, never a position.
  await expect(steps.nth(1)).toHaveAttribute("data-complete", "true");
});

test("a refused config path is reported above Create project", async ({
  page,
}) => {
  // The walk installs the App and leaves the reader on the repository step.
  // The API refuses a path that does not end in `.json`, such as the
  // TypeScript configuration Mokly no longer reads, so this is the real
  // refusal rather than a routed one.
  await atRepositoryStep(page, "config-path");
  await chooseRepository(page);
  await expect(page.getByLabel("Project slug")).not.toHaveValue("");
  await page.getByLabel("Config path").fill("mokly.config.ts");
  await page.getByTestId("create-project").click();

  // `validation-failed` does not say which value was refused, so the cause
  // belongs above the control rather than on the one field the reader types.
  const control = page.getByTestId("create-project");
  await expect(
    page.locator(".fo-write-failure").getByTestId("create-project"),
    "the control is inside the fragment",
  ).toBeVisible();
  await expect(
    page.locator(".fo-write-failure").getByRole("alert"),
    "the cause is above the control",
  ).toHaveText("Check the values and try again.");
  await expect(control, "the control is the way back").toHaveText("Try again");
  await expect(
    page.getByLabel("Config path"),
    "the config path is retained",
  ).toHaveValue("mokly.config.ts");
  for (const field of ["Config path", "Repository", "Project slug"]) {
    await expect(
      page.getByLabel(field, { exact: true }),
      `${field} is unmarked`,
    ).toHaveAttribute("aria-invalid", "false");
  }
});

/** Walk a new account through the installation as far as the repository step. */
async function atRepositoryStep(page: Page, label: string): Promise<void> {
  await signIn(page, freshEmail(label));
  await page.waitForURL((url) => url.pathname === "/new");
  await page.getByLabel("Workspace name").fill(`${label} Org`);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === "/install");
  await installApp(page);
}

test("a repository list that could not be read offers the read again", async ({
  page,
}) => {
  let reads = 0;
  // The list is read for the open workspace, so the address carries a query.
  await page.route(
    (url) => url.pathname === "/v1/github/installations",
    (route) => {
      // Only the read: installing is what put the reader on this step.
      if (route.request().method() !== "GET") return route.continue();
      reads += 1;
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "unavailable",
            reason: "unavailable",
            message: "Try again shortly.",
            request_id: "01994f10-0000-7000-8000-0000000000bb",
          },
        }),
      });
    },
  );
  await atRepositoryStep(page, "unread");

  const failed = page.getByRole("alert");
  await expect(failed).toContainText("Repositories couldn’t load");
  await expect(failed.locator("details")).toHaveCount(1);
  await expect.poll(() => reads).toBe(1);

  // Try again is the same read, asked for again, and it is the only way on:
  // a project is a repository the App can read.
  await page.getByTestId("retry-repositories").click();
  await expect.poll(() => reads).toBe(2);
  await expect(page.getByRole("alert")).toContainText(
    "Repositories couldn’t load",
  );
  await expect(page.getByTestId("create-project")).toHaveCount(0);
  await page.unrouteAll();
});

test("a repository list that comes back empty offers the manage link", async ({
  page,
}) => {
  // The App answers, and grants this installation no repository.
  await page.route("**/v1/github/installations/*/repositories", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      // The page the contract declares, not a shorter one the server
      // cannot send.
      body: JSON.stringify({
        items: [],
        nextCursor: null,
      } satisfies ApiBody<"listInstallations">),
    }),
  );
  await atRepositoryStep(page, "unlisted");

  await expect(repositoryField(page)).toContainText("No repositories yet");
  await expect(
    page.getByRole("link", { name: "Manage repository access" }),
  ).toHaveAttribute("href", manageUrl);
  await expect(page.getByTestId("create-project")).toBeDisabled();
  await page.unrouteAll();
});
