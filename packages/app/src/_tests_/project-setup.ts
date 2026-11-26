import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  createWorkspacePath,
  installPath,
  projectSetupPath,
} from "../navigation/paths";
import { projectName } from "../screens/account/project-name";

import { installedRepository } from "./database-fixture";
import { installThroughApi, installApp } from "./github-installation";
import { open, ready } from "./harness";
import { apiOrigin } from "./origins";

/**
 * The repository step's own field. It carries one stable accessible name, so
 * the control is the same control however the reader has answered it, and it
 * is the same element whether or not there is anything to choose.
 */
export function repositoryField(page: Page) {
  return page.getByLabel("Repository", { exact: true });
}

/** Choose one installed repository from the repository step's own field. */
export async function chooseRepository(
  page: Page,
  repository = installedRepository,
): Promise<void> {
  await repositoryField(page).click();
  await page.getByRole("option", { name: repository }).click();
}

/** The config path the repository step starts with. */
const configPath = "mokly.config.json";

/**
 * Give a signed-in reader a created project and answer with its identifier,
 * for every test whose subject comes after onboarding. It sends the requests
 * the onboarding walk sends, in its order, through the reader's session: the
 * workspace step's create with its suggested slug, the installation exchange
 * the two GitHub pages drive, and the repository step's create for the
 * recorded installation's one repository with its suggested slug. It ends
 * where the walk ends, on the project's setup step, once that step has read
 * the default branch.
 *
 * The walk itself is `walkToProject`, which the onboarding specs keep. A
 * walk on another application origin, such as the desktop shell's, also
 * stays the walk, because that origin is its subject.
 */
export async function createProject(
  page: Page,
  workspace: string,
  origin?: string,
): Promise<string> {
  if (origin) return walkToProject(page, workspace, origin);
  const workspaceId = await createWorkspaceThroughApi(page, workspace);
  await installThroughApi(page, workspaceId);
  const project = await createProjectThroughApi(page, workspaceId);
  await open(page, projectSetupPath(project.workspaceSlug, project.slug));
  // The setup step reads the default branch once it has drawn, and Open
  // project replaces its placeholders only when that read has answered, so a
  // test that counts its own reads starts after it.
  await expect(page.getByTestId("open-project")).toBeVisible();
  return project.id;
}

/** Create one workspace with the slug the workspace step suggests for it. */
async function createWorkspaceThroughApi(
  page: Page,
  name: string,
): Promise<string> {
  return page.evaluate(
    async ([origin, workspaceName]) => {
      const session = await fetch(`${origin}/v1/session`, {
        credentials: "include",
      });
      const { csrfToken } = (await session.json()) as { csrfToken: string };
      const suggestion = await fetch(
        `${origin}/v1/workspaces/slug-suggestion?` +
          new URLSearchParams({ name: workspaceName }).toString(),
        { credentials: "include" },
      );
      if (!suggestion.ok)
        throw new Error(`workspace slug failed: ${suggestion.status}`);
      const { slug } = (await suggestion.json()) as { slug: string };
      const answer = await fetch(`${origin}/v1/workspaces`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ name: workspaceName, slug }),
      });
      if (!answer.ok) throw new Error(`workspace failed: ${answer.status}`);
      return ((await answer.json()) as { id: string }).id;
    },
    [apiOrigin, name] as const,
  );
}

/**
 * Create the project the repository step creates: the installed repository,
 * read from the workspace's installation as the step reads it, named after the
 * repository, with the starting config path and the suggested slug.
 */
async function createProjectThroughApi(
  page: Page,
  workspaceId: string,
): Promise<{ id: string; workspaceSlug: string; slug: string }> {
  return page.evaluate(
    async ([origin, workspace, repository, name, config]) => {
      const read = async <Body>(path: string): Promise<Body> => {
        const answer = await fetch(origin + path, { credentials: "include" });
        if (!answer.ok) throw new Error(`${path} failed: ${answer.status}`);
        return (await answer.json()) as Body;
      };
      type Items<Item> = { items: Item[] };
      const session = await read<{ csrfToken: string }>("/v1/session");
      const installations = await read<Items<{ id: string }>>(
        `/v1/github/installations?workspaceId=${workspace}`,
      );
      const installation = installations.items[0];
      if (!installation) throw new Error("the workspace installed nothing");
      const repositories = await read<Items<{ id: string; fullName: string }>>(
        `/v1/github/installations/${installation.id}/repositories`,
      );
      const chosen = repositories.items.find(
        (item) => item.fullName === repository,
      );
      if (!chosen) throw new Error(`the App cannot read ${repository}`);
      const { slug } = await read<{ slug: string }>(
        `/v1/workspaces/${workspace}/projects/slug-suggestion?` +
          new URLSearchParams({ repository, configPath: config }).toString(),
      );
      const answer = await fetch(
        `${origin}/v1/workspaces/${workspace}/projects`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({
            name,
            slug,
            configPath: config,
            repositoryId: chosen.id,
          }),
        },
      );
      if (!answer.ok) throw new Error(`project failed: ${answer.status}`);
      return (await answer.json()) as {
        id: string;
        workspaceSlug: string;
        slug: string;
      };
    },
    [
      apiOrigin,
      workspaceId,
      installedRepository,
      projectName(installedRepository),
      configPath,
    ] as const,
  );
}

/**
 * Walk a new account to a created project through the four onboarding screens
 * and answer with its identifier: the workspace step, the install step through
 * GitHub's two pages, the repository step and the setup step it opens. The
 * installation is part of the walk, because a project is a repository the App
 * can read and there is no way to create one without it, so every project is
 * created for the recorded installation's one repository. `origin` runs the
 * walk on another application origin, such as the desktop shell's, which
 * installs through the API exchange instead of the provider's pages.
 */
export async function walkToProject(
  page: Page,
  workspace: string,
  origin?: string,
): Promise<string> {
  await open(
    page,
    origin ? new URL(createWorkspacePath, origin).href : createWorkspacePath,
  );
  await page.getByLabel("Workspace name").fill(workspace);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL((url) => url.pathname === installPath);
  if (origin) {
    const workspaceId =
      new URL(page.url()).searchParams.get("workspaceId") ?? "";
    await installThroughApi(page, workspaceId);
    await page.reload();
    await page.waitForURL((url) => /^\/[^/]+\/-\/new$/.test(url.pathname));
    await ready(page);
  } else {
    await installApp(page);
  }
  await chooseRepository(page);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL((url) => /^\/[^/]+\/[^/]+\/setup$/.test(url.pathname));
  await ready(page);
  const [, workspaceSlug = "", projectSlug = ""] = new URL(page.url()).pathname
    .split("/")
    .map(decodeURIComponent);
  return page.evaluate(
    async ([origin, workspaceKey, projectKey]) => {
      const answer = await fetch(
        `${origin}/v1/workspaces/by-slug/${encodeURIComponent(workspaceKey)}` +
          `/projects/${encodeURIComponent(projectKey)}`,
        { credentials: "include" },
      );
      if (!answer.ok)
        throw new Error(`project lookup failed: ${answer.status}`);
      return ((await answer.json()) as { id: string }).id;
    },
    [apiOrigin, workspaceSlug, projectSlug] as const,
  );
}
