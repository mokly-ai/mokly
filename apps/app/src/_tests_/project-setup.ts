import type { Page } from "@playwright/test";

import { createWorkspacePath, installPath } from "../navigation/paths";

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

/**
 * Walk a new account to a created project and answer with its identifier. The
 * installation is part of the walk, because a project is a repository the App
 * can read and there is no way to create one without it, so every project is
 * created for the recorded installation's one repository. `origin` runs the
 * walk on another application origin, such as the desktop shell's, which
 * installs through the API exchange instead of the provider's pages.
 */
export async function createProject(
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
