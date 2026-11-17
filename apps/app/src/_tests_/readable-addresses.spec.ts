import { installedRepository } from "./database-fixture";
import { chooseRepository, expect, installApp, open, test } from "./harness";
import {
  captureReadableAddress,
  createWorkspaceStep,
  reachRepositoryStep,
  requestGate,
  uniqueSlug,
} from "./readable-addresses-support";

test("the newest workspace suggestion wins and a manual slug is preserved", async ({
  page,
}) => {
  await createWorkspaceStep(page, "workspace-suggestion-race");
  const firstGate = requestGate();
  const manualGate = requestGate();
  await page.route("**/v1/workspaces/slug-suggestion?*", async (route) => {
    const name = new URL(route.request().url()).searchParams.get("name") ?? "";
    if (name === "First name") await firstGate.wait;
    if (name === "Manual name") await manualGate.wait;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ slug: name.toLowerCase().replaceAll(" ", "-") }),
    });
  });

  const name = page.getByLabel("Workspace name");
  const slug = page.getByLabel("Workspace slug");
  const first = page.waitForRequest(
    (request) =>
      new URL(request.url()).searchParams.get("name") === "First name",
  );
  await name.fill("First name");
  await first;
  // While the suggestion is on its way, the address line names it in place
  // of the address.
  await expect(page.locator(".fo-address-preview")).toContainText(
    "Finding an available address…",
  );
  await name.fill("Second name");
  await expect(slug).toHaveValue("second-name");
  const staleFirst = page.waitForResponse(
    (answer) => new URL(answer.url()).searchParams.get("name") === "First name",
  );
  firstGate.release();
  await staleFirst;
  await expect(slug).toHaveValue("second-name");

  const manual = page.waitForRequest(
    (request) =>
      new URL(request.url()).searchParams.get("name") === "Manual name",
  );
  await name.fill("Manual name");
  await manual;
  await slug.fill("chosen-by-reader");
  const staleManual = page.waitForResponse(
    (answer) =>
      new URL(answer.url()).searchParams.get("name") === "Manual name",
  );
  manualGate.release();
  await staleManual;
  await expect(slug).toHaveValue("chosen-by-reader");
});

test("project suggestions are scoped, ordered, and cannot replace a manual slug", async ({
  page,
}) => {
  const scope = await reachRepositoryStep(page, "project-suggestion-race");
  const firstGate = requestGate();
  const manualGate = requestGate();
  await page.route(
    "**/v1/workspaces/*/projects/slug-suggestion?*",
    async (route) => {
      const url = new URL(route.request().url());
      expect(url.pathname).toBe(
        `/v1/workspaces/${scope.workspaceId}/projects/slug-suggestion`,
      );
      expect(url.searchParams.get("repository")).toBe(installedRepository);
      const configPath = url.searchParams.get("configPath") ?? "";
      if (configPath === "first.config.json") await firstGate.wait;
      if (configPath === "manual.config.json") await manualGate.wait;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slug: configPath.split(".")[0] || "project" }),
      });
    },
  );

  // The repository is chosen from what the App can read, so the suggestion's
  // other typed source, the config path, is what the reader changes.
  await chooseRepository(page);
  const configPath = page.getByLabel("Config path");
  const slug = page.getByLabel("Project slug");
  const suggested = (path: string) => (request: { url(): string }) =>
    new URL(request.url()).searchParams.get("configPath") === path;
  const first = page.waitForRequest(suggested("first.config.json"));
  await configPath.fill("first.config.json");
  await first;
  await expect(page.locator(".fo-address-preview")).toContainText(
    "Finding an available address…",
  );
  await configPath.fill("second.config.json");
  await expect(slug).toHaveValue("second");
  const staleFirst = page.waitForResponse(suggested("first.config.json"));
  firstGate.release();
  await staleFirst;
  await expect(slug).toHaveValue("second");

  const manual = page.waitForRequest(suggested("manual.config.json"));
  await configPath.fill("manual.config.json");
  await manual;
  await slug.fill("project-chosen-by-reader");
  const staleManual = page.waitForResponse(suggested("manual.config.json"));
  manualGate.release();
  await staleManual;
  await expect(slug).toHaveValue("project-chosen-by-reader");
});

test("onboarding creates the exact workspace and project addresses the reader edits", async ({
  page,
}) => {
  const workspaceSlug = uniqueSlug("edited-team");
  const projectSlug = uniqueSlug("edited-project");
  await createWorkspaceStep(page, "edited-addresses");
  await page.getByLabel("Workspace name").fill("Edited Team");
  await expect(page.getByLabel("Workspace slug")).not.toHaveValue("");
  await page.getByLabel("Workspace slug").fill(workspaceSlug);
  await expect(page.locator(".fo-address-preview")).toContainText(
    `/${workspaceSlug}`,
  );
  await captureReadableAddress(page, "desktop-create-workspace");
  await page.getByTestId("create-workspace").click();
  await page.waitForURL((url) => url.pathname === "/install");
  await installApp(page);
  expect(new URL(page.url()).pathname).toBe(`/${workspaceSlug}/-/new`);
  await chooseRepository(page);
  await expect(page.getByLabel("Project slug")).not.toHaveValue("");
  await page.getByLabel("Project slug").fill(projectSlug);
  await expect(page.locator(".fo-address-preview")).toContainText(
    `/${workspaceSlug}/${projectSlug}`,
  );
  await captureReadableAddress(page, "desktop-create-project");
  await page.getByTestId("create-project").click();
  await page.waitForURL(
    (url) => url.pathname === `/${workspaceSlug}/${projectSlug}/setup`,
  );
  await expect(page.getByText(`${workspaceSlug}/${projectSlug}`)).toBeVisible();
  await page.getByTestId("open-project").click();
  await page.waitForURL(
    (url) => url.pathname === `/${workspaceSlug}/${projectSlug}`,
  );
  // A project is named after the repository it was created for.
  await expect(page.getByTestId("viewer-project")).toHaveAccessibleName(
    `Edited Team / ${installedRepository.split("/")[1]}`,
  );
});

test("reserved and malformed slugs recover without blaming a valid name", async ({
  page,
}) => {
  await createWorkspaceStep(page, "address-refusals");
  const name = page.getByLabel("Workspace name");
  const slug = page.getByLabel("Workspace slug");
  await name.fill("Valid Team Name");
  await expect(slug).not.toHaveValue("");
  await slug.fill("docs");
  await page.getByTestId("create-workspace").click();
  await expect(slug).toHaveValue("docs");
  await expect(
    page.getByText(/This address isn’t available\. Try docs-\d+\./),
  ).toBeVisible();
  await expect(slug).toHaveAttribute("aria-invalid", "true");

  const malformed = page.waitForRequest(
    (request) =>
      request.url().endsWith("/v1/workspaces") && request.method() === "POST",
  );
  await slug.fill("Bad_Slug");
  await page.getByTestId("create-workspace").click();
  const body = (await malformed).postDataJSON() as {
    name: string;
    slug: string;
  };
  expect(body).toEqual({ name: "Valid Team Name", slug: "Bad_Slug" });
  await expect(name).toHaveValue("Valid Team Name");
  await expect(name).toHaveAttribute("aria-invalid", "false");
  await expect(slug).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator(".fo-write-failure").getByRole("alert")).toHaveText(
    "Check the values and try again.",
  );
});

test("an empty account can recover directly from the install route", async ({
  page,
}) => {
  await createWorkspaceStep(page, "install-empty");
  await open(page, "/install");
  await expect(
    page.getByRole("heading", { level: 2, name: "Create a workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === "/new");
});
